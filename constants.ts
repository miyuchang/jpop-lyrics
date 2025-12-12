import { SongItem } from './types';

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

export const SONG_LIST: SongItem[] = rawList
  .trim()
  .split('\n')
  .map((line) => {
    const parts = line.split(' - ');
    if (parts.length >= 2) {
      const title = parts[0].trim();
      const artist = parts.slice(1).join(' - ').trim();
      return {
        title,
        artist,
        query: line.trim(),
      };
    }
    return {
      title: line.trim(),
      artist: 'Unknown',
      query: line.trim(),
    };
  })
  .filter(item => item.title);
