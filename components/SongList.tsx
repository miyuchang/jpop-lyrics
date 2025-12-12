import React from 'react';
import { SONG_LIST } from '../constants';
import { SongItem } from '../types';

interface SongListProps {
  currentSong: SongItem | null;
  onSelect: (song: SongItem) => void;
  isLoading: boolean;
}

const SongList: React.FC<SongListProps> = ({ currentSong, onSelect, isLoading }) => {
  return (
    // Flex-1 allows this container to fill the available space in the Sidebar
    // min-h-0 is crucial for nested scrolling within flex items
    <div className="flex-1 min-h-0 flex flex-col bg-stone-50 md:bg-white md:border-r border-stone-200">
      <div className="p-6 md:p-8 border-b border-stone-200 bg-white sticky top-0 z-10 shadow-sm md:shadow-none shrink-0">
        <h2 className="text-lg font-bold text-stone-800 tracking-wider font-sans">
          プレイリスト
        </h2>
        <p className="text-[10px] text-stone-400 mt-1 font-sans uppercase tracking-widest">練習する曲を選択してください</p>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 pb-4">
        {SONG_LIST.map((song, index) => {
          const isSelected = currentSong?.query === song.query;
          return (
            <button
              key={index}
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