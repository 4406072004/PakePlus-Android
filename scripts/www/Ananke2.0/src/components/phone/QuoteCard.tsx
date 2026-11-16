import React, { useState, useRef } from 'react';
import { Edit2, MoreHorizontal, Check, Camera } from 'lucide-react';
import { UserProfile } from '../../types';
import { CARD_BG_PRESETS } from '../../data/defaultThemes';
import { fileToBase64 } from '../../utils/imageUpload';
import { getCardBackgroundStyle } from '../../utils/themeStyles';

const DEFAULT_QUOTE = '仿佛我们一直以来 就注定要在此相遇';

interface QuoteCardProps {
  userProfile: UserProfile;
  cardOpacity?: number;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => void;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({
  userProfile,
  cardOpacity = 1.0,
  onUpdateUserProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempQuote, setTempQuote] = useState(userProfile.quote || DEFAULT_QUOTE);
  const [showBgModal, setShowBgModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cardBgStyle = getCardBackgroundStyle(userProfile.quoteBackground, cardOpacity);

  const currentQuote = userProfile.quote || DEFAULT_QUOTE;

  const handleSaveQuote = () => {
    onUpdateUserProfile({ quote: tempQuote.trim().slice(0, 30) || DEFAULT_QUOTE });
    setIsEditing(false);
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        onUpdateUserProfile({ quoteBackground: `url(${base64})` });
        setShowBgModal(false);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  return (
    <div
      className="relative w-full h-12 min-h-[48px] rounded-3xl px-3.5 py-2 shadow-xs border border-neutral-200/70 flex items-center justify-between overflow-hidden transition-all duration-200 select-none group"
      style={cardBgStyle}
    >
      {/* Background overlay if image is set */}
      {userProfile.quoteBackground?.startsWith('url') && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] pointer-events-none" />
      )}

      {/* Left spacer to perfectly balance the right three dots button for dead-center alignment */}
      <div className="w-6 shrink-0 pointer-events-none" aria-hidden="true" />

      {/* Center quote content - 严格正居中，限制字长，单行不换行 */}
      <div className="relative z-10 flex-1 min-w-0 flex items-center justify-center px-1">
        {isEditing ? (
          <div className="w-full max-w-xs flex items-center gap-1.5 bg-white/95 px-2 py-0.5 rounded-xl border border-neutral-300 shadow-xs">
            <input
              type="text"
              value={tempQuote ?? ''}
              onChange={e => setTempQuote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveQuote()}
              autoFocus
              maxLength={30}
              placeholder="写下一句话（不换行）..."
              className="flex-1 text-xs text-neutral-800 outline-none bg-transparent text-center whitespace-nowrap"
            />
            <button
              type="button"
              onClick={handleSaveQuote}
              className="text-neutral-700 hover:text-pink-600 p-0.5 cursor-pointer shrink-0"
              title="保存"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTempQuote(currentQuote);
              setIsEditing(true);
            }}
            className="w-full text-center flex items-center justify-center gap-1.5 group/text cursor-pointer truncate"
            title="点击编辑（不换行）"
          >
            <span className="text-[11.5px] font-normal tracking-wide text-neutral-700 truncate whitespace-nowrap text-center group-hover/text:text-neutral-900 transition-colors">
              {currentQuote}
            </span>
            <Edit2 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        )}
      </div>

      {/* Right three dots for background customization */}
      <div className="w-6 shrink-0 relative z-10 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowBgModal(true)}
          className="w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/70 transition-colors cursor-pointer"
          title="更换卡片底图"
          aria-label="更换卡片底图"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Background Modal */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-800">更换窄卡片底图</h3>
              <button
                type="button"
                onClick={() => setShowBgModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1"
              >
                关闭
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">预设底色与渐变</label>
                <div className="grid grid-cols-4 gap-2">
                  {CARD_BG_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        onUpdateUserProfile({ quoteBackground: preset.value });
                        setShowBgModal(false);
                      }}
                      className="h-10 rounded-xl border border-neutral-200 shadow-2xs hover:scale-105 active:scale-95 transition-transform relative flex items-center justify-center text-[10px] text-neutral-700 font-medium"
                      style={{ background: preset.value }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">上传自定义图片</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleCustomBgUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-neutral-300 rounded-xl text-xs font-medium text-neutral-600 hover:border-neutral-500 hover:bg-neutral-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  从本地相册选择图片
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateUserProfile({ quoteBackground: '#ffffff' });
                    setShowBgModal(false);
                  }}
                  className="w-full text-center text-xs text-neutral-500 hover:text-neutral-800 py-1"
                >
                  恢复初始纯白色
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
