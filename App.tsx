import React, { useState, useCallback, useEffect } from 'react';
import SongList from './components/SongList';
import LyricsPanel from './components/LyricsPanel';
import LoadingIndicator from './components/LoadingIndicator';
import { SongItem, AppState, LoadingState } from './types';
import { fetchLyricsWithRuby, loadStaticDatabase } from './services/geminiService';
import { SONG_LIST } from './constants';

const CACHE_PREFIX = 'jpop_lyrics_v1_';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentSong: null,
    songData: null,
    status: LoadingState.IDLE,
    errorMsg: null,
  });

  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  
  // Preload State
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({ 
    current: 0, 
    total: SONG_LIST.length, 
    currentSongName: '',
    statusText: '' 
  });

  useEffect(() => {
    loadStaticDatabase();
  }, []);

  const handlePreloadAll = async () => {
    if (!window.confirm("全ての歌詞をブラウザにダウンロードします（約3〜5分かかります）。\nこのページを閉じないでください。\n\n開始しますか？")) {
      return;
    }

    setIsPreloading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < SONG_LIST.length; i++) {
      const song = SONG_LIST[i];
      setPreloadProgress({ 
        current: i + 1, 
        total: SONG_LIST.length, 
        currentSongName: song.title,
        statusText: 'キャッシュ確認中...'
      });

      const cacheKey = CACHE_PREFIX + song.query;
      if (localStorage.getItem(cacheKey)) {
        successCount++;
        continue; 
      }

      try {
        const lyricsHtml = await fetchLyricsWithRuby(song, (status) => {
           setPreloadProgress(prev => ({ ...prev, statusText: status }));
        });

        if (lyricsHtml) {
          localStorage.setItem(cacheKey, lyricsHtml);
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        console.error(`Failed to preload ${song.title}`, e);
        failCount++;
      }

      // Small delay to prevent rate limiting issues and allow UI update
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsPreloading(false);
    alert(`完了しました！\n成功: ${successCount} 曲\n失敗: ${failCount} 曲\n\n失敗した曲は選択時に再度ロードを試みます。`);
  };

  const handleSongSelect = useCallback(async (song: SongItem) => {
    setState(prev => ({
      ...prev,
      currentSong: song,
      songData: null,
      status: LoadingState.SEARCHING_LYRICS,
      errorMsg: null,
    }));
    
    // On mobile, hide list after selection
    setIsMobileListVisible(false);

    try {
      const cacheKey = CACHE_PREFIX + song.query;
      const cachedHtml = localStorage.getItem(cacheKey);

      if (cachedHtml) {
        setState(prev => ({
          ...prev,
          songData: { lyrics: null, lyricsHtml: cachedHtml },
          status: LoadingState.COMPLETED
        }));
        return;
      }

      setState(prev => ({ ...prev, status: LoadingState.GENERATING_FURIGANA }));

      const lyricsHtml = await fetchLyricsWithRuby(song);
      
      if (!lyricsHtml) {
        throw new Error("Lyrics could not be found or generated.");
      }

      try {
        localStorage.setItem(cacheKey, lyricsHtml);
      } catch (e) {
        // Ignore quota errors silently
      }

      setState(prev => ({
        ...prev,
        songData: { lyrics: null, lyricsHtml },
        status: LoadingState.COMPLETED
      }));

    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        status: LoadingState.ERROR,
        errorMsg: "歌詞の読み込みに失敗しました。後でもう一度お試しください。"
      }));
    }
  }, []);

  const handleBackToList = () => {
    setIsMobileListVisible(true);
  };

  return (
    // Use h-[100dvh] for mobile browsers to handle address bar height correctly
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#faf9f6]">
      
      {/* Sidebar: Song List & Controls */}
      <div 
        className={`
          fixed inset-0 z-40 bg-stone-50 transition-transform duration-300 ease-in-out flex flex-col 
          md:relative md:translate-x-0 md:w-96 md:shadow-xl md:h-full md:z-10
          ${isMobileListVisible ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SongList 
          currentSong={state.currentSong}
          onSelect={handleSongSelect}
          isLoading={state.status !== LoadingState.IDLE && state.status !== LoadingState.COMPLETED && state.status !== LoadingState.ERROR}
        />
        
        {/* Bottom Action Area (Sticky) */}
        <div className="shrink-0 p-4 pb-8 md:pb-4 border-t border-stone-200 bg-white md:bg-stone-50 z-20">
           <button
             onClick={handlePreloadAll}
             disabled={isPreloading}
             className={`
               w-full py-3 px-4 rounded-lg font-bold text-sm tracking-wider uppercase transition-all
               flex items-center justify-center gap-2
               ${isPreloading 
                 ? 'bg-stone-200 text-stone-400 cursor-wait' 
                 : 'bg-stone-800 text-white hover:bg-stone-700 shadow-md active:scale-95'
               }
             `}
           >
             {isPreloading ? (
               <>
                 <span className="animate-spin text-lg">⟳</span>
                 <span>{preloadProgress.statusText || `${preloadProgress.current} / ${preloadProgress.total}`}</span>
               </>
             ) : (
               <>
                 <span>⚡️ 全歌詞一括ロード</span>
               </>
             )}
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative w-full md:w-auto bg-[#faf9f6]">
        
        {/* Mobile Back Button (Floating) */}
        {!isMobileListVisible && (
          <button 
            onClick={handleBackToList}
            className="md:hidden absolute top-4 left-4 z-30 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg border border-stone-100 text-stone-600 active:scale-90 transition-transform flex items-center justify-center"
            aria-label="Back to song list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative w-full pb-20 md:pb-0">
          {state.status === LoadingState.IDLE && !state.currentSong && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center">
              <div className="text-4xl mb-4">🎵</div>
              <p className="text-sm font-sans tracking-widest uppercase">曲を選択して練習を開始しましょう</p>
            </div>
          )}

          <LoadingIndicator state={state.status} />

          {state.status === LoadingState.ERROR && (
            <div className="h-full flex items-center justify-center p-8">
               <div className="bg-red-50 text-red-600 p-6 rounded-lg max-w-md text-center border border-red-100">
                  <p className="font-bold mb-2">Error</p>
                  <p className="text-sm">{state.errorMsg}</p>
                  <button 
                    onClick={() => state.currentSong && handleSongSelect(state.currentSong)}
                    className="mt-4 px-4 py-2 bg-white border border-red-200 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition-colors"
                  >
                    Retry
                  </button>
               </div>
            </div>
          )}

          {state.status === LoadingState.COMPLETED && state.songData && state.currentSong && (
            <LyricsPanel 
              title={state.currentSong.title}
              artist={state.currentSong.artist}
              htmlContent={state.songData.lyricsHtml}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;