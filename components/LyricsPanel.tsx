import React from 'react';

interface LyricsPanelProps {
  htmlContent: string | null;
  title: string;
  artist: string;
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({ htmlContent, title, artist }) => {
  if (!htmlContent) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-10 text-left border-l-4 border-stone-800 pl-6 py-2">
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-2 tracking-tight">{title}</h1>
        <p className="text-stone-500 font-medium text-sm tracking-wide uppercase">{artist}</p>
      </div>
      
      <div 
        className="
          text-lg md:text-xl 
          text-stone-800 
          font-medium 
          leading-[1.5]
          text-left 
          whitespace-pre-wrap 
          tracking-wider
        "
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
      />
      
      <div className="mt-16 pt-8 border-t border-stone-200 text-left">
        <span className="inline-flex items-center text-stone-300 text-[10px] uppercase tracking-widest font-sans">
          Gemini AI で生成
        </span>
      </div>
    </div>
  );
};

export default LyricsPanel;