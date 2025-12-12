import { GoogleGenAI } from "@google/genai";
import { SongItem } from "../types";

// Aggressively try to find the API Key from various environment locations
const getApiKey = () => {
  let key = '';

  // 1. Try Vite / Modern ES pattern (import.meta.env)
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
  } catch (e) {
    // Ignore access errors
  }

  if (key) return key;

  // 2. Try Standard process.env (Webpack/Node/System)
  try {
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.VITE_API_KEY || 
            process.env.REACT_APP_API_KEY || 
            process.env.NEXT_PUBLIC_API_KEY || 
            process.env.API_KEY || 
            '';
    }
  } catch (e) {
    // Ignore process undefined errors
  }

  return key;
};

const apiKey = getApiKey();

// Debugging: Log status to console (safe, reveals only first 4 chars)
if (apiKey) {
  console.log(`✅ API Key loaded: ${apiKey.substring(0, 4)}...`);
} else {
  console.error("❌ API Key not found in any environment variable (VITE_API_KEY, API_KEY, etc).");
}

const ai = new GoogleGenAI({ apiKey });
const MODEL_NAME = 'gemini-2.5-flash';

// --- Static Database Layer ---
let staticDb: Record<string, string> | null = null;
let isDbLoaded = false;

export const loadStaticDatabase = async () => {
  if (isDbLoaded) return;
  try {
    const response = await fetch('/lyrics-db.json');
    if (response.ok) {
      staticDb = await response.json();
      console.log("📚 Static lyrics database loaded successfully.");
    }
  } catch (error) {
    console.warn("⚠️ Could not load static lyrics database.");
  } finally {
    isDbLoaded = true;
  }
};

/**
 * STRATEGY 1: Two-Step Search
 * Step A: Search for raw text only (Accuracy priority)
 * Step B: Format text to HTML/Ruby (Formatting priority)
 */
const fetchLyricsViaSearch = async (song: SongItem, onStatusChange?: (status: string) => void): Promise<string | null> => {
  try {
    // --- Step A: Get Raw Lyrics ---
    onStatusChange?.("Web検索中 (Musixmatch/LyricFind)...");
    
    // Improved Prompt: STRICTLY Japanese sites, prioritize User requests
    const searchPrompt = `
      Find the **OFFICIAL Japanese lyrics** (日本語歌詞) for the song "${song.title}" by "${song.artist}".
      
      Requirements:
      1. **PRIORITY SEARCH**: Search specifically on **Musixmatch**, **LyricFind**, Uta-Net, or J-Lyric.
      2. **ABSOLUTELY NO ROMAJI**.
      3. **ABSOLUTELY NO ENGLISH TRANSLATION**.
      4. Return ONLY the raw Japanese lyrics text.
      5. Ensure you retrieve the FULL song, not just a snippet.
      
      If you cannot find the full Japanese lyrics, return "NOT_FOUND".
    `;

    const searchResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Very low temperature for factual retrieval
      },
    });

    let rawLyrics = searchResponse.text?.trim();
    
    // Basic validation: If result contains mostly English or is too short, fail.
    if (!rawLyrics || rawLyrics.includes("NOT_FOUND") || rawLyrics.length < 50) {
      console.warn("Search result too short or empty, falling back.");
      return null;
    }

    // Capture sources for attribution
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: string[] = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: any): uri is string => typeof uri === 'string');
    const uniqueSources = [...new Set(sources)];

    // --- Step B: Format to Ruby HTML ---
    onStatusChange?.("Web検索中 (ふりがな付与)...");

    const formatPrompt = `
      You are a precise formatter.
      Take the following Japanese lyrics and format them into HTML with Furigana (Ruby tags).

      SOURCE LYRICS:
      """
      ${rawLyrics}
      """

      INSTRUCTIONS:
      1. Output raw HTML only.
      2. Add <ruby> tags to **EVERY** Kanji.
      3. Use <br/> for line breaks.
      4. Do not change the content of the lyrics, just format them.
      5. **Check for Ateji**: If the lyrics imply a special reading (e.g., 本気 read as マジ), use that reading.
      6. **CLEAN UP**: Remove any weird punctuation, scanning artifacts, '[?]', asterisks, or non-standard symbols often found in raw text. Use standard Japanese punctuation.
      7. **Validation**: If the SOURCE LYRICS above appear to be English translations or Romaji, output "INVALID_INPUT" instead of formatting.
    `;

    const formatResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: formatPrompt,
      config: {
        temperature: 0.2, 
      },
    });

    let html = formatResponse.text?.trim();
    if (!html || html.includes("INVALID_INPUT")) return null;

    html = html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');

    // Append Source Attribution
    if (uniqueSources.length > 0) {
      const sourceListHtml = uniqueSources.slice(0, 3)
        .map(url => `<a href="${url}" target="_blank" style="color:#a8a29e;text-decoration:underline;margin-right:10px;">${new URL(url).hostname}</a>`)
        .join('');
      html += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;font-size:0.75rem;color:#a8a29e;"><p>出典 (Search):</p>${sourceListHtml}</div>`;
    }

    return html;

  } catch (e) {
    console.warn(`Search strategy failed for ${song.title}`, e);
    return null;
  }
};

/**
 * STRATEGY 2: Standard Fallback (No Search, No Thinking)
 * Uses standard generation to recall lyrics when search fails.
 * Removed "thinkingConfig" as it may cause stability issues on some devices/keys.
 */
const fetchLyricsViaFallback = async (song: SongItem): Promise<string | null> => {
  const prompt = `
    You are a professional lyrics editor.
    Recall and output the **OFFICIAL, FULL VERSION** Japanese lyrics for:
    Song: "${song.title}"
    Artist: "${song.artist}"

    CRITICAL:
    1. Output raw HTML.
    2. Add <ruby> tags to **EVERY** Kanji (e.g. <ruby>汉<rt>かん</rt></ruby>).
    3. Use <br/> for line breaks.
    4. **Think carefully** about special readings (Ateji) used in the song.
    5. **CLEAN UP**: Ensure no weird symbols or markdown artifacts appear in the output.
    6. No markdown blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.2,
        // thinkingConfig removed for better stability on mobile/fallback
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

/**
 * Main Entry Point: Hybrid Strategy
 */
export const fetchLyricsWithRuby = async (song: SongItem, onStatusChange?: (status: string) => void): Promise<string | null> => {
  // 1. Check Static Database
  if (staticDb && staticDb[song.query]) {
    onStatusChange?.("キャッシュ読み込み中..."); // Loading from cache
    await new Promise(r => setTimeout(r, 200));
    return staticDb[song.query];
  }

  if (!apiKey) {
    console.error("API Key is missing. Check VITE_API_KEY configuration.");
    throw new Error("API Key is missing");
  }

  // 2. Try Search (Best Quality for New/Specific Songs)
  const searchResult = await fetchLyricsViaSearch(song, onStatusChange);
  if (searchResult) return searchResult;

  // 3. Fallback to Standard Generation (Reliable)
  onStatusChange?.("AI生成モードに切り替え中 (Standard)..."); 
  const fallbackResult = await fetchLyricsViaFallback(song);
  if (fallbackResult) return fallbackResult;

  throw new Error("Failed to generate lyrics via both Search and AI.");
};