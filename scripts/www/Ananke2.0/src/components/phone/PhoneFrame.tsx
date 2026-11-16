import React from 'react';
import { PhoneStatusBar } from './PhoneStatusBar';
import { PhoneHomeIndicator } from './PhoneHomeIndicator';
import { PhoneSettings, Character, CompanionSession } from '../../types';
import { getCardBackgroundStyle } from '../../utils/themeStyles';
import { COLOR_THEMES } from '../../data/defaultThemes';

interface PhoneFrameProps {
  settings: PhoneSettings;
  character: Character;
  activeSession: CompanionSession | null;
  onHomeClick: () => void;
  onOpenCompanion: () => void;
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  settings,
  character,
  activeSession,
  onHomeClick,
  onOpenCompanion,
  children,
}) => {
  // Desktop outer background & wallpaper
  const wallpaperStyle = getCardBackgroundStyle(settings.wallpaper || '#ececec');
  const currentTheme = COLOR_THEMES.find(t => t.id === settings.themeId) || COLOR_THEMES[0];
  const barBackground = currentTheme.bgGradient || currentTheme.cardBg || '#f4f4f5';

  const [viewportHeight, setViewportHeight] = React.useState<number | null>(() => 
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : null
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return (
    <div 
      className="w-full overflow-hidden flex items-center justify-center bg-neutral-900 select-none"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh', maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* 
        Virtual Phone Chassis:
        - Mobile: w-full h-full no margins/borders, clamped tight.
        - Desktop: max-w-[420px] h-[min(100dvh,870px)] rounded-[48px] with sleek outer chassis border & shadow
      */}
      <div 
        className="relative w-full h-full sm:max-w-[412px] sm:h-[min(100dvh,860px)] sm:rounded-[44px] overflow-hidden flex flex-col justify-between shadow-2xl sm:border-[8px] sm:border-neutral-800 transition-all duration-300 bg-neutral-100"
      >
        {/* 1. Phone Top Status Bar (保留选择的 UI 颜色) */}
        <div 
          className="shrink-0 z-20 transition-colors shadow-2xs"
          style={{ background: barBackground }}
        >
          <PhoneStatusBar 
            darkText={true} 
            isCompanionActive={activeSession?.status === 'active'}
            onOpenCompanion={onOpenCompanion}
          />
        </div>

        {/* 2. Main Phone Content Area (桌面底图自适应比例，带遮罩度) */}
        <main 
          className="flex-1 w-full overflow-hidden relative z-10 flex flex-col"
          style={wallpaperStyle}
        >
          {/* 主界面底图遮罩层（让背景图颜色减淡，让图标和卡片更清晰） */}
          {settings.wallpaperMask !== undefined && settings.wallpaperMask > 0 && (
            <div 
              className="absolute inset-0 pointer-events-none z-0 transition-opacity"
              style={{
                backgroundColor: `rgba(255, 255, 255, ${settings.wallpaperMask})`
              }}
            />
          )}

          {/* Subtle glass reflection overlay for high-end phone feel */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none z-30" />

          <div className="relative z-10 w-full h-full flex flex-col">
            {children}
          </div>
        </main>


        {/* 4. Phone Bottom Home Gesture Bar (保留选择的 UI 颜色) */}
        <div 
          className="shrink-0 z-20 transition-colors shadow-2xs"
          style={{ background: barBackground }}
        >
          <PhoneHomeIndicator onHomeClick={onHomeClick} darkBar={true} />
        </div>
      </div>
    </div>
  );
};
