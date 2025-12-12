import React from 'react';

interface LyricsPanelProps {
  htmlContent: string | null;
  title: string;
  artist: string;
  onRegenerate: () => void; // New prop for regeneration
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({ htmlContent, title, artist, onRegenerate }) => {
  if (!htmlContent) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-10 text-left border-l-4 border-stone-800 pl-6 py-2 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-2 tracking-tight">{title}</h1>
          <p className="text-stone-500 font-medium text-sm tracking-wide uppercase">{artist}</p>
        </div>
      </div>
      
      <div 
        className="
          text-lg md:text-xl 
          text-stone-800 
          font-medium 
          leading-[1.8]
          text-left 
          whitespace-pre-wrap 
          tracking-wider
        "
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
      />
      
      <div className="mt-16 pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="inline-flex items-center text-stone-300 text-[10px] uppercase tracking-widest font-sans">
          Gemini AI による検索・解析
        </span>

        <button 
          onClick={() => {
            if(window.confirm('現在の歌詞データを削除して、もう一度Webから検索し直しますか？')) {
              onRegenerate();
            }
          }}
          className="
            text-xs font-bold text-stone-400 hover:text-red-500 transition-colors
            flex items-center gap-2 border border-stone-200 px-3 py-2 rounded-full hover:border-red-200
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          歌詞が間違っていますか？再検索する
        </button>
      </div>
    </div>
  );
};

export default LyricsPanel;