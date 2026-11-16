import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhoneOff } from 'lucide-react';
import { Character } from '../../types';
import { ActiveCallSession, callService } from '../../core/CallService';

interface DraggableCallBubbleProps {
  character: Character;
  session: ActiveCallSession;
  onExpand: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const DraggableCallBubble: React.FC<DraggableCallBubbleProps> = ({
  character,
  session,
  onExpand,
}) => {
  // 气泡坐标（默认右上角）
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (session.minimizedPos) return session.minimizedPos;
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 130) : 260;
    return { x: defaultX, y: 64 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const hasMovedSignificantlyRef = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 限制坐标在视口或容器内部
  const clampPos = useCallback((x: number, y: number) => {
    const bubbleWidth = bubbleRef.current?.offsetWidth || 96;
    const bubbleHeight = bubbleRef.current?.offsetHeight || 32;
    const maxX = Math.max(10, (window?.innerWidth || 400) - bubbleWidth - 10);
    const maxY = Math.max(10, (window?.innerHeight || 700) - bubbleHeight - 10);
    return {
      x: Math.min(Math.max(10, x), maxX),
      y: Math.min(Math.max(48, y), maxY),
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // 如果点击的是挂断小按钮，不触发拖拽
    if ((e.target as HTMLElement).closest('.call-bubble-hangup-btn')) {
      return;
    }

    isDraggingRef.current = true;
    hasMovedSignificantlyRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedSignificantlyRef.current = true;
    }

    const newX = dragStartRef.current.startX + dx;
    const newY = dragStartRef.current.startY + dy;
    const clamped = clampPos(newX, newY);
    setPos(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // 记录最新位置
    callService.setMinimizedPos(pos);

    // 如果几乎没有位移，视作点击唤起放大
    if (!hasMovedSignificantlyRef.current) {
      onExpand();
    }
  };

  const handleHangup = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    callService.endCall('通话已结束');
  };

  useEffect(() => {
    if (session.minimizedPos) {
      setPos(session.minimizedPos);
    }
  }, [session.minimizedPos]);

  return (
    <div
      ref={bubbleRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: 'none',
      }}
      className="fixed z-50 flex items-center gap-1.5 h-7.5 px-2 bg-neutral-900/90 text-white rounded-full shadow-2xl border border-white/20 backdrop-blur-md cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-emerald-500/20 active:scale-95 animate-fade-in"
      title="点击展开通话窗口，长按拖动移动位置"
    >
      {/* 极简迷你头像 */}
      <div className="w-4.5 h-4.5 rounded-full overflow-hidden border border-emerald-400 shrink-0">
        <img src={character.avatar} alt={character.name} className="w-full h-full object-cover pointer-events-none" />
      </div>

      {/* 绿点微光呼吸 */}
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />

      {/* 极简 monospace 通话时长 */}
      <span className="font-mono text-[10.5px] font-semibold text-emerald-300 tracking-tight shrink-0">
        {formatDuration(session.duration)}
      </span>

      {/* 极简迷你挂断键（直接挂断，不弹回原窗口） */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
        }}
        onClick={handleHangup}
        className="call-bubble-hangup-btn w-4.5 h-4.5 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center text-white shrink-0 ml-0.5 transition-transform cursor-pointer"
        title="直接挂断通话"
      >
        <PhoneOff className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};
