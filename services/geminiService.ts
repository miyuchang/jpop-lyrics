import { GoogleGenAI } from "@google/genai";
import { SongItem } from "../types";

// Aggressively try to find the API Key from various environment locations
const getApiKey = () => {
  let key = '';

  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY || 
            // @ts-ignore
            import.meta.env.REACT_APP_API_KEY || 
            // @ts-ignore
            import.meta.env.NEXT_PUBLIC_API_KEY || 
            // @ts-ignore
            import.meta.env.API_KEY || 
            '';
    }
  } catch (e) {}

  if (key) return key;

  try {
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.VITE_API_KEY || 
            process.env.REACT_APP_API_KEY || 
            process.env.NEXT_PUBLIC_API_KEY || 
            process.env.API_KEY || 
            '';
    }
  } catch (e) {}

  return key;
};

const apiKey = getApiKey();

if (apiKey) {
  console.log(`✅ API Key loaded: ${apiKey.substring(0, 4)}...`);
} else {
  console.error("❌ API Key not found.");
}

const ai = new GoogleGenAI({ apiKey });

// Primary Model (Smarter, for Search)
const MODEL_SEARCH = 'gemini-2.5-flash';
// Fallback Model (Faster, More Stable for Mobile)
const MODEL_FALLBACK = 'gemini-1.5-flash';

// Permissive safety settings
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// --- Static Database Layer ---
let staticDb: Record<string, string> | null = null;
let isDbLoaded = false;

export const loadStaticDatabase = async () => {
  if (isDbLoaded) return;
  try {
    const response = await fetch('/lyrics-db.json');
    if (response.ok) {
      staticDb = await response.json();
      console.log("📚 Static lyrics database loaded.");
    }
  } catch (error) {
    console.warn("⚠️ Could not load static lyrics database.");
  } finally {
    isDbLoaded = true;
  }
};

/**
 * Helper to simple-format raw text if AI fails
 */
const simpleFormat = (text: string) => {
  return text.split('\n').map(line => line.trim()).join('<br/>');
};

/**
 * STRATEGY 1: Search + Format
 */
const fetchLyricsViaSearch = async (song: SongItem, onStatusChange?: (status: string) => void): Promise<string | null> => {
  try {
    // --- Step A: Get Raw Lyrics ---
    onStatusChange?.("Web検索中 (Musixmatch/LyricFind)...");
    
    const searchPrompt = `
      Find the **OFFICIAL Japanese lyrics** (日本語歌詞) for the song "${song.title}" by "${song.artist}".
      Requirements:
      1. Search on **Musixmatch**, **LyricFind**, Uta-Net, or J-Lyric.
      2. **NO ROMAJI**, **NO TRANSLATION**.
      3. Return ONLY the raw Japanese lyrics text.
      
      If not found, return "NOT_FOUND".
    `;

    const searchResponse = await ai.models.generateContent({
      model: MODEL_SEARCH,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        safetySettings: SAFETY_SETTINGS,
      },
    });

    let rawLyrics = searchResponse.text?.trim();
    
    if (!rawLyrics || rawLyrics.includes("NOT_FOUND") || rawLyrics.length < 50) {
      console.warn("Search result invalid, falling back.");
      return null;
    }

    // Capture sources
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: string[] = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: any): uri is string => typeof uri === 'string');
    const uniqueSources = [...new Set(sources)];

    // --- Step B: Format to Ruby HTML ---
    onStatusChange?.("Web検索中 (ふりがな・解析)...");

    const formatPrompt = `
      Format these Japanese lyrics into HTML with <ruby> tags for EVERY Kanji.
      Use <br/> for line breaks. Output HTML only.
      
      LYRICS:
      ${rawLyrics}
    `;

    try {
      const formatResponse = await ai.models.generateContent({
        model: MODEL_SEARCH, // Keep 2.5 for formatting as it's smarter with Kanji
        contents: formatPrompt,
        config: {
          temperature: 0.2,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      let html = formatResponse.text?.trim();
      if (!html) throw new Error("Formatting failed");

      html = html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');

      // Add attribution
      if (uniqueSources.length > 0) {
        const sourceListHtml = uniqueSources.slice(0, 3)
          .map(url => `<a href="${url}" target="_blank" style="color:#a8a29e;text-decoration:underline;margin-right:10px;">${new URL(url).hostname}</a>`)
          .join('');
        html += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;font-size:0.75rem;color:#a8a29e;"><p>出典 (Search):</p>${sourceListHtml}</div>`;
      }
      return html;

    } catch (formatError) {
      console.warn("Search success but Format failed. Returning raw lyrics.");
      // SAFETY NET: If we found lyrics but failed to add ruby, return raw text formatted simply
      // This prevents "Error" on mobile when the heavy formatting step times out
      let backupHtml = simpleFormat(rawLyrics);
      backupHtml += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;font-size:0.75rem;color:#a8a29e;"><p>※ふりがな生成に失敗したため、原文を表示しています。</p></div>`;
      return backupHtml;
    }

  } catch (e) {
    console.warn(`Search strategy failed for ${song.title}`, e);
    return null;
  }
};

/**
 * STRATEGY 2: Standard Fallback (Fast & Stable)
 * Uses gemini-1.5-flash which is faster and more reliable on mobile networks.
 */
const fetchLyricsViaFallback = async (song: SongItem): Promise<string | null> => {
  const prompt = `
    Recall OFFICIAL lyrics for: "${song.title}" by "${song.artist}".
    Output raw HTML.
    Add <ruby> tags to EVERY Kanji.
    Use <br/> for line breaks.
    No markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FALLBACK, // SWITCHED TO 1.5-FLASH FOR STABILITY
      contents: prompt,
      config: {
        temperature: 0.2,
        safetySettings: SAFETY_SETTINGS,
        maxOutputTokens: 8192, // Ensure long songs don't get cut off
      },
    });

    let html = response.text?.trim();
    if (!html) return null;
    return html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');
  } catch (e) {
    console.error(`Fallback attempt failed for ${song.title}`, e);
    return null;
  }
};

export const fetchLyricsWithRuby = async (song: SongItem, onStatusChange?: (status: string) => void): Promise<string | null> => {
  // 1. Check Static Database
  if (staticDb && staticDb[song.query]) {
    onStatusChange?.("キャッシュ読み込み中...");
    await new Promise(r => setTimeout(r, 200));
    return staticDb[song.query];
  }

  if (!apiKey) throw new Error("API Key is missing");

  // 2. Try Search
  const searchResult = await fetchLyricsViaSearch(song, onStatusChange);
  if (searchResult) return searchResult;

  // 3. Fallback to Standard Generation
  onStatusChange?.("検索が見つからないため、AI補完を実行中..."); 
  const fallbackResult = await fetchLyricsViaFallback(song);
  if (fallbackResult) return fallbackResult;

  throw new Error("Failed to generate lyrics.");
};