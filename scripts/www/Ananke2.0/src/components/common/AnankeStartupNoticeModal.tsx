import React, { useState, useRef } from 'react';
import { AnankeLogo } from './AnankeLogo';
import { AnankeNoticeContent } from './AnankeNoticeContent';
import { ChevronDown } from 'lucide-react';

interface AnankeStartupNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnankeStartupNoticeModal: React.FC<AnankeStartupNoticeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [skipFuture, setSkipFuture] = useState(true); // 默认开启“仅阅读一次之后跳过”
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // 允许 15px 容差
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 15;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleConfirm = () => {
    if (!agreed) return;
    if (skipFuture) {
      try {
        localStorage.setItem('ananke_startup_notice_skipped', 'true');
      } catch (err) {
        console.error('Failed to save notice skip preference:', err);
      }
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 select-none animate-fade-in"
    >
      <div className="bg-white rounded-2xl max-w-[310px] w-full max-h-[75vh] flex flex-col shadow-2xl border border-neutral-200/90 overflow-hidden">
        {/* Header with Ananke Logo */}
        <div className="pt-3 pb-1.5 px-3 flex flex-col items-center border-b border-neutral-100 bg-[#faf9f6]/80 shrink-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-neutral-200/60 flex items-center justify-center bg-white mb-1.5">
            <AnankeLogo size={40} />
          </div>
          <h3 className="text-xs font-bold text-neutral-900 tracking-wide">
            Ananke字卡｜初次使用说明
          </h3>
          <p className="text-[9px] text-neutral-500 mt-0.5">
            请向下滑动阅读完整说明（划到底部方可勾选）
          </p>
        </div>

        {/* Scrollable Notice Content Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-neutral-50/50"
        >
          <AnankeNoticeContent />

          {/* Bottom Reach Anchor & Indicator */}
          <div className="py-1.5 flex items-center justify-center text-[9px] text-neutral-400">
            {hasScrolledToBottom ? (
              <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ✓ 已完整阅读至底部，下方勾选框已解锁
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-bounce">
                <ChevronDown className="w-3 h-3" />
                <span>请继续向下划到底部以解锁勾选</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer Agreement & Actions */}
        <div className="p-2.5 bg-white border-t border-neutral-200/80 shrink-0 space-y-2">
          {/* Checkboxes Area */}
          <div className="space-y-1 text-xs">
            {/* Checkbox 1: 我已同意 */}
            <label
              className={`flex items-center gap-1.5 p-1 rounded-lg transition-all ${
                !hasScrolledToBottom
                  ? 'opacity-40 cursor-not-allowed text-neutral-400'
                  : 'cursor-pointer hover:bg-neutral-50 text-neutral-800'
              }`}
            >
              <input
                type="checkbox"
                disabled={!hasScrolledToBottom}
                checked={agreed}
                onChange={e => {
                  if (hasScrolledToBottom) setAgreed(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded text-neutral-900 focus:ring-0 cursor-pointer disabled:cursor-not-allowed shrink-0"
              />
              <span className="text-[10px] font-medium leading-none">
                我已阅读并同意上述说明与免责声明
              </span>
            </label>

            {/* Checkbox 2: 仅阅读一次之后跳过 */}
            <label
              className={`flex items-center gap-1.5 p-1 rounded-lg transition-all ${
                !hasScrolledToBottom
                  ? 'opacity-40 cursor-not-allowed text-neutral-400'
                  : 'cursor-pointer hover:bg-neutral-50 text-neutral-800'
              }`}
            >
              <input
                type="checkbox"
                disabled={!hasScrolledToBottom}
                checked={skipFuture}
                onChange={e => {
                  if (hasScrolledToBottom) setSkipFuture(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded text-neutral-900 focus:ring-0 cursor-pointer disabled:cursor-not-allowed shrink-0"
              />
              <span className="text-[10px] text-neutral-600 leading-none">
                仅阅读一次之后跳过（勾选后不再弹出）
              </span>
            </label>
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={!hasScrolledToBottom || !agreed}
            onClick={handleConfirm}
            className={`w-full py-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all shadow-2xs ${
              hasScrolledToBottom && agreed
                ? 'bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95 cursor-pointer'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {hasScrolledToBottom
              ? agreed
                ? '确认并进入应用'
                : '请勾选我已同意'
              : '请先向下滑动到底部'}
          </button>
        </div>
      </div>
    </div>
  );
};
