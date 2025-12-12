import { GoogleGenAI } from "@google/genai";
import { SongItem } from "../types";

// Aggressively try to find the API Key
const getApiKey = () => {
  let key = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY || import.meta.env.REACT_APP_API_KEY || import.meta.env.NEXT_PUBLIC_API_KEY || import.meta.env.API_KEY || '';
    }
  } catch (e) {}
  if (key) return key;
  try {
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.VITE_API_KEY || process.env.REACT_APP_API_KEY || process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY || '';
    }
  } catch (e) {}
  return key;
};

const apiKey = getApiKey();
if (apiKey) console.log(`✅ API Key loaded: ${apiKey.substring(0, 4)}...`);
else console.error("❌ API Key not found.");

const ai = new GoogleGenAI({ apiKey });

// Use 2.5 Flash for Search (Best balance of speed and tool usage)
const MODEL_SEARCH = 'gemini-2.5-flash';

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// --- Static Database ---
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

const simpleFormat = (text: string) => text.split('\n').map(line => line.trim()).join('<br/>');

/**
 * Core Search Function
 * Tries to find raw lyrics text using Google Search Grounding.
 */
const performSearch = async (targetQuery: string, instructions: string): Promise<{text: string, sources: string[]} | null> => {
  const prompt = `
    TASK: Use the Google Search tool to find lyrics.
    
    SEARCH QUERY TO EXECUTE:
    ${targetQuery}

    INSTRUCTIONS:
    ${instructions}

    If the lyrics text is found, output it directly.
    Do not output markdown code blocks. Just the raw text.
    If absolutely NOT FOUND, return "NOT_FOUND".
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SEARCH,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        safetySettings: SAFETY_SETTINGS,
      },
    });

    let text = response.text?.trim();
    
    // Clean up potential markdown blocks from search result
    if (text) {
      text = text.replace(/^```(html|json|text)?/, '').replace(/```$/, '').trim();
    }
    
    // Basic Validation
    if (!text || text.includes("NOT_FOUND") || text.length < 50) {
      return null;
    }

    // Check for Japanese characters (Hiragana/Katakana/Kanji) to ensure we didn't get an English translation
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    if (!hasJapanese) {
      console.warn("Search returned text, but no Japanese characters found. Discarding.");
      return null;
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: string[] = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: any): uri is string => typeof uri === 'string');

    return { text, sources: [...new Set(sources)] };

  } catch (e) {
    console.warn(`Search attempt failed for query: ${targetQuery}`, e);
    return null;
  }
};

/**
 * Formatter Function
 * Takes raw text and adds Ruby tags.
 */
const formatLyrics = async (rawLyrics: string): Promise<string> => {
  const formatPrompt = `
    You are a Japanese text processor specializing in Furigana (reading support).
    
    TASK: Convert the input lyrics into HTML, wrapping EVERY Kanji word in <ruby> tags.

    INPUT TEXT:
    ${rawLyrics}

    CRITICAL RULES:
    1. **WRAP EVERY KANJI**: Use <ruby>Kanji<rt>Kana</rt></ruby>.
       - Example: 明日 -> <ruby>明日<rt>あした</rt></ruby>
       - Example: 運命 -> <ruby>運命<rt>さだめ</rt></ruby> (Use context for reading!)
    2. **KEEP FORMAT**: Use <br/> for line breaks. Do not merge lines.
    3. **OUTPUT ONLY HTML**: Do not output markdown (\`\`\`). Do not output "Here is the HTML".
    4. **NO TRANSLATION**: Keep the original Japanese lyrics exactly as they are.

    OUTPUT EXPECTATION:
    <ruby>私<rt>わたし</rt></ruby>は<ruby>今<rt>いま</rt></ruby><br/>
    <ruby>歌<rt>うた</rt></ruby>を<ruby>歌<rt>うた</rt></ruby>う
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SEARCH,
      contents: formatPrompt,
      config: {
        temperature: 0.1, // Zero creativity, pure formatting
        safetySettings: SAFETY_SETTINGS,
      },
    });

    let html = response.text?.trim();
    if (!html) throw new Error("Empty format response");
    
    // Clean markdown if present
    html = html.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');

    // Validation: If no ruby tags are found, something went wrong.
    // However, if the song is purely Hiragana/Katakana/English (rare), this might trigger falsely.
    // We'll check if there were Kanjis in the input vs ruby tags in output.
    const hasKanjiInput = /[\u4E00-\u9FAF]/.test(rawLyrics);
    if (hasKanjiInput && !html.includes('<ruby>')) {
        console.warn("Format warning: Input had Kanji but output has no Ruby tags.");
        // We could throw here to trigger fallback, but fallback is plain text anyway.
        // Let's assume the user prefers plain text over nothing, but append a warning.
        return html + `<div style="margin-top:20px;font-size:0.75rem;color:#f87171;">※AIがふりがなを生成できませんでした。</div>`;
    }
    
    return html;
  } catch (e) {
    console.warn("Formatting failed, falling back to simple format.", e);
    return simpleFormat(rawLyrics) + 
           `<div style="margin-top:20px;font-size:0.75rem;color:#888;">※ふりがな解析に失敗しました（原文表示）</div>`;
  }
};

/**
 * Main Entry Point
 */
export const fetchLyricsWithRuby = async (song: SongItem, onStatusChange?: (status: string) => void): Promise<string | null> => {
  // 1. Check Static Database
  if (staticDb && staticDb[song.query]) {
    onStatusChange?.("キャッシュ読み込み中...");
    await new Promise(r => setTimeout(r, 200));
    return staticDb[song.query];
  }

  if (!apiKey) throw new Error("API Key is missing");

  // --- STRATEGY 1: SURGICAL STRIKE (Musixmatch/LyricFind) ---
  // We use "site:" operators to force Google to look ONLY at the best sources.
  onStatusChange?.("Web検索中 (Musixmatch/LyricFind)...");
  
  const siteOperators = 'site:musixmatch.com OR site:lyricfind.com OR site:utaten.com OR site:uta-net.com OR site:j-lyric.net';
  const strictQuery = `${song.title} ${song.artist} ${siteOperators}`;
  
  let result = await performSearch(strictQuery, 
    "Navigate to the search result from Musixmatch, LyricFind, or Uta-Net. Extract the full Japanese lyrics text exactly."
  );

  // --- STRATEGY 2: BROAD SEARCH (Fallback) ---
  if (!result) {
    onStatusChange?.("詳細検索中 (一般検索)...");
    const broadQuery = `${song.title} ${song.artist} 歌詞 日本語`;
    result = await performSearch(broadQuery, 
      "Search for the official lyrics text. Do not generate fake lyrics. If not found, strictly return NOT_FOUND."
    );
  }

  // 4. Fail if nothing found
  if (!result) {
    console.error(`Lyrics not found for ${song.title}`);
    throw new Error("Lyrics Not Found on Web");
  }

  // 5. Format Result
  onStatusChange?.("解析・ふりがな付与中...");
  let html = await formatLyrics(result.text);

  // Add Source Attribution
  if (result.sources.length > 0) {
    const sourceListHtml = result.sources.slice(0, 3)
      .map(url => {
        try {
          return `<a href="${url}" target="_blank" style="color:#a8a29e;text-decoration:underline;margin-right:10px;">${new URL(url).hostname}</a>`;
        } catch (e) { return ''; }
      })
      .join('');
    html += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e5e4;font-size:0.75rem;color:#a8a29e;"><p>出典 (Search):</p>${sourceListHtml}</div>`;
  }

  return html;
};