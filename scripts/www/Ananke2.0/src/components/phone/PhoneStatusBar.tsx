import React, { useState, useEffect } from 'react';
import { Wifi, Battery } from 'lucide-react';

interface PhoneStatusBarProps {
  darkText?: boolean;
  isCompanionActive?: boolean;
  onOpenCompanion?: () => void;
}

export const PhoneStatusBar: React.FC<PhoneStatusBarProps> = ({ 
  darkText = true,
  isCompanionActive = false,
  onOpenCompanion,
}) => {
  const [time, setTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const textColorClass = darkText ? 'text-neutral-800' : 'text-neutral-200';

  return (
    <div className={`h-11 px-6 flex items-center justify-between text-xs font-semibold tracking-tight select-none shrink-0 z-20 ${textColorClass}`}>
      {/* Dynamic Time */}
      <span className="font-mono tabular-nums text-sm font-medium">{time}</span>

      {/* 顶栏中间状态：陪伴模式进行中展示醒目交互角标，平时显示“Ananke字卡” */}
      {isCompanionActive ? (
        <button
          type="button"
          onClick={onOpenCompanion}
          className="px-2.5 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full flex items-center gap-1.5 text-[10px] font-bold shadow-xs cursor-pointer animate-pulse border border-white/60 active:scale-95 transition-all"
          title="陪伴模式运行中，点击进入陪伴窗口"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span>陪伴中</span>
        </button>
      ) : (
        <div className="px-3 py-0.5 bg-neutral-900/10 rounded-full flex items-center justify-center text-[11px] font-semibold text-neutral-800 tracking-wider">
          Ananke
        </div>
      )}

      {/* Status Icons */}
      <div className="flex items-center gap-1.5">
        {/* Signal Bars */}
        <div className="flex items-end gap-0.5 h-3">
          <span className="w-0.5 h-1.5 bg-current rounded-xs" />
          <span className="w-0.5 h-2 bg-current rounded-xs" />
          <span className="w-0.5 h-2.5 bg-current rounded-xs" />
          <span className="w-0.5 h-3 bg-current rounded-xs" />
        </div>
        <Wifi className="w-3.5 h-3.5" />
        <div className="flex items-center gap-0.5">
          <Battery className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
