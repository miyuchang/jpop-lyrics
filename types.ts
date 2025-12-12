export interface SongItem {
  artist: string;
  title: string;
  query: string; // The full string from the list
}

export interface SongData {
  lyrics: string | null; // Raw lyrics
  lyricsHtml: string | null; // With Ruby tags
}

export enum LoadingState {
  IDLE = 'IDLE',
  SEARCHING_LYRICS = 'SEARCHING_LYRICS',
  GENERATING_FURIGANA = 'GENERATING_FURIGANA',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AppState {
  currentSong: SongItem | null;
  songData: SongData | null;
  status: LoadingState;
  errorMsg: string | null;
}