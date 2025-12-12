import React, { useState } from 'react';
import { SongItem } from '../types';

interface SongListProps {
  songs: SongItem[]; // Received from parent
  currentSong: SongItem | null;
  onSelect: (song: SongItem) => void;
  onAdd: (song: SongItem) => void; // Callback to add new song
  isLoading: boolean;
}

const SongList: React.FC<SongListProps> = ({ songs, currentSong, onSelect, onAdd, isLoading }) => {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    const newSong: SongItem = {
      title: customTitle.trim(),
      artist: customArtist.trim() || 'Unknown Artist',
      query: `${customTitle.trim()} - ${customArtist.trim() || 'Unknown'}`
    };

    onAdd(newSong); // Add to list instead of just selecting
    
    // Clear form and close mode slightly for better UX
    setCustomTitle('');
    setCustomArtist('');
    // setIsSearchMode(false); // Optional: keep open if they want to add more
  };

  return (
    // Flex-1 allows this container to fill the available space in the Sidebar
    // min-h-0 is crucial for nested scrolling within flex items
    <div className="flex-1 min-h-0 flex flex-col bg-stone-50 md:bg-white md:border-r border-stone-200">
      <div className="p-6 md:p-8 border-b border-stone-200 bg-white sticky top-0 z-10 shadow-sm md:shadow-none shrink-0">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-stone-800 tracking-wider font-sans">
            プレイリスト
          </h2>
          <button 
            onClick={() => setIsSearchMode(!isSearchMode)}
            className={`
              transition-colors p-1 rounded-full
              ${isSearchMode ? 'bg-stone-100 text-stone-800' : 'text-stone-400 hover:text-stone-800'}
            `}
            title="自由検索 / Free Search"
          >
            {isSearchMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
          </button>
        </div>
        
        {isSearchMode ? (
          <form onSubmit={handleCustomSearch} className="mt-4 animate-fadeIn">
            <div className="space-y-3">
               <div>
                 <input 
                   type="text" 
                   placeholder="曲名 (Song Title)" 
                   value={customTitle}
                   onChange={(e) => setCustomTitle(e.target.value)}
                   className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-400 transition-colors"
                   required
                 />
               </div>
               <div>
                 <input 
                   type="text" 
                   placeholder="歌手 (Artist)" 
                   value={customArtist}
                   onChange={(e) => setCustomArtist(e.target.value)}
                   className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded text-sm focus:outline-none focus:border-stone-400 transition-colors"
                 />
               </div>
               <button 
                 type="submit"
                 disabled={isLoading || !customTitle.trim()}
                 className="w-full py-2 bg-stone-800 text-white text-xs font-bold rounded hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isLoading ? '検索中...' : 'リストに追加して生成'}
               </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-2 text-center">
              リストに追加され、自動的に歌詞を検索します
            </p>
          </form>
        ) : (
          <p className="text-[10px] text-stone-400 mt-1 font-sans uppercase tracking-widest">
            練習する曲を選択、または検索
          </p>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 pb-4">
        {songs.map((song, index) => {
          const isSelected = currentSong?.query === song.query;
          return (
            <button
              key={`${song.query}-${index}`}
              onClick={() => !isLoading && onSelect(song)}
              disabled={isLoading}
              className={`w-full text-left p-4 mb-2 rounded-lg transition-all duration-200 group relative overflow-hidden
                ${isSelected 
                  ? 'bg-stone-800 text-white shadow-md' 
                  : 'bg-white md:bg-transparent hover:bg-stone-100 text-stone-700 border border-stone-100 md:border-transparent'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
              `}
            >
              <div className="flex flex-col relative z-10">
                <h3 className={`font-bold text-sm mb-1 font-sans ${isSelected ? 'text-white' : 'text-stone-800'}`}>
                  {song.title}
                </h3>
                <p className={`text-xs font-sans ${isSelected ? 'text-stone-400' : 'text-stone-400'}`}>
                  {song.artist}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SongList;