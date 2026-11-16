import React, { useState, useRef } from 'react';
import { MoreHorizontal, Check, Camera, Calendar } from 'lucide-react';
import { UserProfile, Character } from '../../types';
import { CARD_BG_PRESETS } from '../../data/defaultThemes';
import { fileToBase64 } from '../../utils/imageUpload';
import { getCardBackgroundStyle } from '../../utils/themeStyles';

interface MeetDaysCardProps {
  userProfile: UserProfile;
  character: Character;
  cardOpacity?: number;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => void;
}

const getTodayStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const calculateDiffDays = (dateStr: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 0;
    const [y, m, d] = parts;
    const start = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (isNaN(days) || !isFinite(days)) return 0;
    return Math.max(0, days);
  } catch {
    return 0;
  }
};

const formatChineseDate = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') {
    const [y, m, d] = getTodayStr().split('-');
    return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  }
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    return `${parts[0]}年${parts[1]}月${parts[2]}日`;
  } catch {
    return dateStr;
  }
};

export const MeetDaysCard: React.FC<MeetDaysCardProps> = ({
  userProfile,
  character,
  cardOpacity = 1.0,
  onUpdateUserProfile,
}) => {
  // 初始相爱日期为0，不要预设任何日期
  const effectiveDate = userProfile.meetStartDate || '';
  const displayDays = effectiveDate ? calculateDiffDays(effectiveDate) : (userProfile.meetDays || 0);

  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState(effectiveDate || getTodayStr());
  const [showBgModal, setShowBgModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cardBgStyle = getCardBackgroundStyle(userProfile.meetDaysBackground, cardOpacity);

  const handleSaveDate = () => {
    if (tempDate) {
      const calculatedDays = calculateDiffDays(tempDate);
      onUpdateUserProfile({
        meetStartDate: tempDate,
        meetDays: calculatedDays,
      });
    }
    setShowDatePickerModal(false);
  };

  const handleClearDate = () => {
    onUpdateUserProfile({
      meetStartDate: '',
      meetDays: 0,
    });
    setTempDate('');
    setShowDatePickerModal(false);
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        onUpdateUserProfile({ meetDaysBackground: `url(${base64})` });
        setShowBgModal(false);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  const partnerName = character?.nickname || character?.name || 'TA';
  const myName = userProfile?.name || '我';

  return (
    <div
      className="relative w-full h-24 sm:h-28 min-h-[96px] rounded-3xl px-2.5 sm:px-3 py-2 sm:py-2.5 shadow-xs border border-neutral-200/70 flex flex-col justify-between items-center overflow-hidden transition-all duration-200 select-none group"
      style={cardBgStyle}
    >
      {/* Background overlay if image is set */}
      {userProfile.meetDaysBackground?.startsWith('url') && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] pointer-events-none" />
      )}

      {/* 第1行：卡片上面中间一行淡字“XX与XX”（左角色名，右我的名字） */}
      <div className="relative z-10 w-full flex justify-center pt-0.5">
        <span className="text-[10px] sm:text-[11px] font-light text-neutral-400 tracking-wider text-center truncate max-w-[90%]">
          {partnerName} 与 {myName}
        </span>
      </div>

      {/* 第2行：中间“相爱…天”（点击天数可选取日期，初始0天，自动计算至今天，随现实时间增加） */}
      <div className="relative z-10 flex items-center justify-center my-auto">
        <button
          type="button"
          onClick={() => {
            setTempDate(effectiveDate);
            setShowDatePickerModal(true);
          }}
          className="group/days flex items-baseline justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 rounded-2xl hover:bg-neutral-50/60 active:scale-98 transition-all cursor-pointer"
          title="点击选取起始日期"
        >
          <span className="text-xs sm:text-sm font-light text-neutral-600 tracking-wide">
            相爱
          </span>
          <span className="text-2xl sm:text-3xl font-mono font-bold text-neutral-900 tabular-nums tracking-tight border-b-2 border-transparent group-hover/days:border-neutral-400">
            {displayDays}
          </span>
          <span className="text-xs sm:text-sm font-light text-neutral-600 tracking-wide">
            天
          </span>
        </button>
      </div>

      {/* 第3行：最下面中间有一行淡字，即选取的起始日期“某年某月某日”，未设置时提示“点击设定起始日期” */}
      <div className="relative z-10 w-full flex justify-center pb-0.5">
        <span className="text-[9.5px] sm:text-[10px] font-light text-neutral-400 tracking-wider text-center truncate max-w-[95%]">
          {effectiveDate ? formatChineseDate(effectiveDate) : '点击设定起始日期'}
        </span>
      </div>

      {/* 右下角三个点更换底图（绝对定位不干扰三行居中文字） */}
      <div className="absolute bottom-1.5 right-1.5 z-10">
        <button
          type="button"
          onClick={() => setShowBgModal(true)}
          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 transition-colors cursor-pointer"
          title="更换卡片底图"
          aria-label="更换卡片底图"
        >
          <MoreHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>

      {/* --- Modal 1: 选取起始日期弹窗 --- */}
      {showDatePickerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-neutral-800">
                <Calendar className="w-4 h-4 text-pink-500" />
                <h3 className="text-sm font-semibold">选择相爱起始日期</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1"
              >
                取消
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">
                  设定相遇/相爱起始日
                </label>
                <input
                  type="date"
                  value={tempDate ?? ''}
                  max={getTodayStr()}
                  onChange={e => setTempDate(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-sm font-mono text-neutral-800 outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
              </div>

              {/* 实时预览天数 */}
              <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100 text-center">
                <span className="text-xs text-neutral-500 block mb-0.5">计算结果</span>
                <span className="text-base font-semibold text-pink-600">
                  已相爱 {calculateDiffDays(tempDate)} 天
                </span>
                <span className="text-[11px] text-neutral-400 block mt-1 font-mono">
                  起始于 {formatChineseDate(tempDate)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearDate}
                  className="py-2 px-2.5 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-500 hover:bg-neutral-50 cursor-pointer"
                >
                  清除日期(0天)
                </button>
                <button
                  type="button"
                  onClick={() => setTempDate(getTodayStr())}
                  className="flex-1 py-2 px-2 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                >
                  设为今天
                </button>
                <button
                  type="button"
                  onClick={handleSaveDate}
                  className="flex-1 py-2 px-3 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确定保存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal 2: 更换底图弹窗 --- */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-800">更换相爱卡片底图</h3>
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
                        onUpdateUserProfile({ meetDaysBackground: preset.value });
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
                    onUpdateUserProfile({ meetDaysBackground: '#ffffff' });
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
