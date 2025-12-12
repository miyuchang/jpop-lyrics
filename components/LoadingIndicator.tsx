import React from 'react';
import { LoadingState } from '../types';

interface LoadingIndicatorProps {
  state: LoadingState;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ state }) => {
  if (state === LoadingState.IDLE || state === LoadingState.COMPLETED || state === LoadingState.ERROR) return null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-[50vh] text-stone-500 animate-pulse">
      <div className="mb-4 text-3xl opacity-80">✨</div>
      <p className="font-sans text-sm tracking-widest uppercase text-stone-400">
        歌詞を検索・解析中...
      </p>
    </div>
  );
};

export default LoadingIndicator;