/**
 * J-Pop Lyricist Database Generator
 * 
 * Run this script to pre-generate lyrics for all songs.
 * Usage: node scripts/generate_db.js
 * (Make sure process.env.API_KEY is set)
 */

import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("❌ Error: API_KEY is missing.");
  console.error("Usage: export API_KEY=your_key && node scripts/generate_db.js");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'lyrics-db.json');

// Same list as constants.ts
const rawList = `
あのね。 - あれくん &『ユイカ』
嘘月 - ヨルシカ
打上花火 - DAOKO x 米津玄師
Eden - MONKEY MAJIK
Anytime Anywhere - milet
大阪LOVER - DREAMS COME TRUE
踊り子 - Vaundy
おもかげ(produced by Vaundy) - miletxAimerx幾田りら
オレンジ - SPYAIR
怪獣 - サカナクション
怪獣の花唄 - Vaundy
革命道中-On The Way(TVサイズ) - アイナ・ジ・エンド
カタオモイ - Aimer
Gloomy Day - ロザリーナ
恋風 - 幾田りら
残酷な天使のテーゼ - 高橋洋子
Shout Baby - 绿黄色社会
Jupiter - 平原綾香
シルエット - KANA-BOON
好きだから。 - ユイカ
ステージから君に捧ぐ - ギヴン
spiral - LONGMAN
星座になれたら - 結束バンド
宇宙を見上げて - saya
タイミング〜Timing〜 - Klang Ruler
小さな恋のうた - MONGOL800
departure! - 小野正利
どうかしてる - WurtS
Naru - ラックライフ
裸の勇者 - Vaundy
ハルカトオク - saya
晚餐歌 - tuki.
ヒトミナカ - 丁
風神 - Vaundy
冬のはなし - ギヴン
「僕は...」 - あたらよ
more than words - 羊文学
ライラック - Mrs. GREEN APPLE
REASON - ゆず
`;

const SONG_LIST = rawList.trim().split('\n').map(line => line.trim());

// --- Helper Functions ---

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchLyrics(songQuery) {
  const parts = songQuery.split(' - ');
  const title = parts[0];
  const artist = parts[1] || '';

  const prompt = `
    You are a strict and professional Japanese lyrics editor.
    Your task is to recall the **OFFICIAL, FULL VERSION** lyrics for the song:
    
    Song: "${title}"
    Artist: "${artist}"

    CRITICAL INSTRUCTIONS:
    1. **ACCURACY IS PARAMOUNT**: Use your internal knowledge to retrieve the exact official lyrics. Do not summarize, do not use "TV Size" versions, and do not make up lines.
    2. **FORMAT**: Output the lyrics in HTML.
    3. **FURIGANA (RUBY)**: Add Furigana to **EVERY** Kanji using <ruby> tags.
       - **SPECIAL READINGS (Ateji)**: Pay close attention to how the artist *actually sings* the word. 
         (e.g., if '本気' is sung as 'マジ', output <ruby>本気<rt>マジ</rt></ruby>).
    4. **LAYOUT**: Use <br/> tags for line breaks. Separate stanzas clearly.
    5. **CLEAN OUTPUT**: Output raw HTML string only. No markdown.

    If unsure, return "NOT_FOUND".
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { 
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 2048 },
        maxOutputTokens: 8192
      },
    });

    let text = response.text?.trim();
    if (text) {
      // Clean up markdown if present
      text = text.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');
    }
    return text;
  } catch (error) {
    console.error(`Failed to fetch ${songQuery}:`, error.message);
    return null;
  }
}

// --- Main Execution ---

async function main() {
  console.log(`🎵 Starting generation for ${SONG_LIST.length} songs...`);
  console.log(`📂 Output: ${OUTPUT_FILE}`);
  
  // Load existing DB if possible to avoid re-fetching
  let db = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      console.log(`ℹ️  Loaded existing DB with ${Object.keys(db).length} songs.`);
    } catch (e) {}
  }

  for (const [index, song] of SONG_LIST.entries()) {
    if (db[song] && db[song].length > 50) {
      console.log(`[${index + 1}/${SONG_LIST.length}] ✅ Skipped (Already exists): ${song}`);
      continue;
    }

    console.log(`[${index + 1}/${SONG_LIST.length}] ⏳ Generating: ${song}`);
    
    const html = await fetchLyrics(song);
    
    if (html && html !== "NOT_FOUND") {
      db[song] = html;
      // Save progressively
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2));
    } else {
      console.log(`❌ Failed or Not Found: ${song}`);
    }

    // Rate limiting delay (important for free tier)
    await delay(4000); 
  }

  console.log("\n✨ All done! Database generated.");
}

main();