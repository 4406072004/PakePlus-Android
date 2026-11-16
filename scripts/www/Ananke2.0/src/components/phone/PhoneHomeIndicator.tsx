import React from 'react';

interface PhoneHomeIndicatorProps {
  onHomeClick?: () => void;
  darkBar?: boolean;
}

export const PhoneHomeIndicator: React.FC<PhoneHomeIndicatorProps> = ({ onHomeClick, darkBar = true }) => {
  return (
    <div 
      className="h-6 w-full flex items-center justify-center shrink-0 cursor-pointer active:opacity-70 transition-opacity z-20"
      onClick={onHomeClick}
      title="返回桌面"
    >
      <div 
        className={`w-32 h-1 rounded-full transition-colors ${
          darkBar ? 'bg-neutral-800/60 hover:bg-neutral-900' : 'bg-white/60 hover:bg-white'
        }`} 
      />
    </div>
  );
};
