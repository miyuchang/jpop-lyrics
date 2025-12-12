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
 * STRATEGY 1: Google Search Grounding
 * High accuracy, real lyrics. Can fail if search results are poor.
 */
const fetchLyricsViaSearch = async (song: SongItem): Promise<string | null> => {
  const prompt = `
    Find **official Japanese lyrics** for "${song.title}" by "${song.artist}" using Google Search.
    
    INSTRUCTIONS:
    1. Extract the FULL lyrics.
    2. Format as HTML with <ruby> tags for EVERY Kanji.
    3. Use <br/> for line breaks.
    4. Output RAW HTML only. No markdown.
    
    If not found, return "NOT_FOUND".
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    let html = response.text?.trim();
    if (!html || html.includes("NOT_FOUND")) return null;

    html = html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');

    // Add Source attribution
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: string[] = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: any): uri is string => typeof uri === 'string');
    
    const uniqueSources = [...new Set(sources)];
    if (uniqueSources.length > 0) {
      const sourceListHtml = uniqueSources.slice(0, 3)
        .map(url => `<a href="${url}" target="_blank" style="color:#a8a29e;text-decoration:underline;margin-right:10px;">${new URL(url).hostname}</a>`)
        .join('');
      // Translated "Source:" to "出典:"
      html += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;font-size:0.75rem;color:#a8a29e;"><p>出典:</p>${sourceListHtml}</div>`;
    }

    return html;
  } catch (e) {
    console.warn(`Search attempt failed for ${song.title}`, e);
    return null;
  }
};

/**
 * STRATEGY 2: Thinking Model (Generative Fallback)
 * Uses deep thinking to recall lyrics when search fails. Always returns a result.
 */
const fetchLyricsViaThinking = async (song: SongItem): Promise<string | null> => {
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
    5. No markdown blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 2048 }, // Enable thinking for accuracy
        maxOutputTokens: 8192,
      },
    });

    let html = response.text?.trim();
    if (!html) return null;
    return html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');
  } catch (e) {
    console.error(`Thinking attempt failed for ${song.title}`, e);
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

  // 2. Try Search (Best Quality)
  onStatusChange?.("Web検索中..."); // Searching web
  const searchResult = await fetchLyricsViaSearch(song);
  if (searchResult) return searchResult;

  // 3. Fallback to Thinking (Best Reliability)
  onStatusChange?.("AI生成モードに切り替え中..."); // Switching to AI generation
  const thinkingResult = await fetchLyricsViaThinking(song);
  if (thinkingResult) return thinkingResult;

  throw new Error("Failed to generate lyrics via both Search and AI.");
};