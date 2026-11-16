import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  CheckSquare, 
  Square, 
  RotateCcw, 
  Smile, 
  Image as ImageIcon,
  Sliders,
  Plus,
  Check
} from 'lucide-react';
import { StorageService } from '../../services/StorageService';
import { DEFAULT_STICKERS, DEFAULT_EMOJIS } from '../../data/defaultStickers';
import { PhoneSettings } from '../../types';

interface StickerEmojiPickerProps {
  settings: PhoneSettings;
  onUpdateSettings?: (updates: Partial<PhoneSettings>) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

/**
 * 表情包轻量 Canvas 智能压缩（控制在 300x300，约 30KB~50KB 内）
 */
function compressStickerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片格式文件'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_SIZE = 300;
          let width = img.width;
          let height = img.height;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 Canvas'));
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/webp', 0.85);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export const StickerEmojiPicker: React.FC<StickerEmojiPickerProps> = ({
  settings,
  onUpdateSettings,
  onSelectSticker,
  onSelectEmoji,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'stickers' | 'emojis' | 'settings'>('stickers');
  const [stickers, setStickers] = useState<string[]>(() => StorageService.getCustomStickers());
  const [emojis, setEmojis] = useState<string[]>(() => StorageService.getCustomEmojis());
  
  // 批量管理表情包
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedStickerIndices, setSelectedStickerIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 批量管理 Emoji
  const [isEmojiBatchMode, setIsEmojiBatchMode] = useState(false);
  const [selectedEmojiIndices, setSelectedEmojiIndices] = useState<Set<number>>(new Set());

  // 添加自定义 Emoji
  const [newEmojiInput, setNewEmojiInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 批量导入表情包（上限 9 张）
  const handleBatchImportStickers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 9) {
      showToast('单次批量最多选择 9 张表情包，已自动选取前 9 张');
    }

    const filesToProcess = Array.from(files).slice(0, 9);
    setIsImporting(true);

    try {
      const newUrls: string[] = [];
      for (const file of filesToProcess) {
        try {
          const url = await compressStickerImage(file);
          newUrls.push(url);
        } catch (err) {
          console.warn('Compress sticker skipped:', err);
        }
      }

      if (newUrls.length > 0) {
        const updated = [...newUrls, ...stickers];
        setStickers(updated);
        StorageService.saveCustomStickers(updated);
        showToast(`成功导入 ${newUrls.length} 张表情包！`);
      }
    } catch {
      showToast('导入表情包出现异常');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 删除单张表情包
  const handleDeleteSticker = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = stickers.filter((_, i) => i !== idx);
    const safe = updated.length > 0 ? updated : DEFAULT_STICKERS;
    setStickers(safe);
    StorageService.saveCustomStickers(safe);
    showToast('已删除该表情包');
  };

  // 批量删除表情包
  const handleBatchDeleteStickers = () => {
    if (selectedStickerIndices.size === 0) return;
    const updated = stickers.filter((_, i) => !selectedStickerIndices.has(i));
    const safe = updated.length > 0 ? updated : DEFAULT_STICKERS;
    setStickers(safe);
    StorageService.saveCustomStickers(safe);
    setSelectedStickerIndices(new Set());
    setIsBatchMode(false);
    showToast('批量删除完成');
  };

  // 恢复默认表情包
  const handleResetStickers = () => {
    setStickers(DEFAULT_STICKERS);
    StorageService.saveCustomStickers(DEFAULT_STICKERS);
    showToast('已恢复预设表情包');
  };

  // 添加自定义 Emoji
  const handleAddEmoji = () => {
    const trimmed = newEmojiInput.trim();
    if (!trimmed) return;
    if (emojis.includes(trimmed)) {
      showToast('该 Emoji 已存在');
      return;
    }
    const updated = [trimmed, ...emojis];
    setEmojis(updated);
    StorageService.saveCustomEmojis(updated);
    setNewEmojiInput('');
    showToast('已添加 Emoji');
  };

  // 批量删除 Emoji
  const handleBatchDeleteEmojis = () => {
    if (selectedEmojiIndices.size === 0) return;
    const updated = emojis.filter((_, i) => !selectedEmojiIndices.has(i));
    const safe = updated.length > 0 ? updated : [];
    setEmojis(safe);
    StorageService.saveCustomEmojis(safe);
    setSelectedEmojiIndices(new Set());
    setIsEmojiBatchMode(false);
    showToast('批量删除 Emoji 完成');
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-neutral-200/80 shadow-2xl flex flex-col max-h-[380px] h-[380px] animate-in fade-in slide-in-from-bottom-6 duration-200 select-none">
      {/* 顶部标签切换与关闭 */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-neutral-100 shrink-0">
        <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'stickers'
                ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
            <span>表情包 ({stickers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emojis')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'emojis'
                ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-amber-500" />
            <span>Emoji</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'settings'
                ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            title="表情与Emoji设置开关"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>规则设置</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 提示消息 */}
      {toastMessage && (
        <div className="mx-3 mt-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[10px] text-center font-medium animate-fade-in shrink-0">
          {toastMessage}
        </div>
      )}

      {/* TAB 1: 表情包页 */}
      {activeTab === 'stickers' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2">
          {/* 操作栏 */}
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[10px] text-neutral-400">
              点击表情可直接发送 · 角色回复将附带表情
            </span>

            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                onChange={handleBatchImportStickers}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-medium flex items-center gap-1 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                <span>{isImporting ? '压缩导入中...' : '导入表情(最多9张)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setSelectedStickerIndices(new Set());
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  isBatchMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {isBatchMode ? '退出批量' : '批量管理'}
              </button>

              <button
                type="button"
                onClick={handleResetStickers}
                className="text-[10px] text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                title="恢复预设表情包"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 批量操作控制条 */}
          {isBatchMode && (
            <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/80 shrink-0">
              <span className="text-[10px] text-neutral-500">
                已选 {selectedStickerIndices.size} 项 / 共 {stickers.length} 项
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStickerIndices.size === stickers.length) {
                      setSelectedStickerIndices(new Set());
                    } else {
                      setSelectedStickerIndices(new Set(stickers.map((_, i) => i)));
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white border border-neutral-200 text-neutral-700 cursor-pointer"
                >
                  {selectedStickerIndices.size === stickers.length ? '全不选' : '全选'}
                </button>
                <button
                  type="button"
                  onClick={handleBatchDeleteStickers}
                  disabled={selectedStickerIndices.size === 0}
                  className="px-2.5 py-0.5 rounded text-[10px] bg-rose-600 text-white font-medium disabled:opacity-40 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          )}

          {/* 表情包网格列表 */}
          <div className="flex-1 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-2 pr-1 content-start">
            {stickers.map((sticker, idx) => {
              const isSelected = selectedStickerIndices.has(idx);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isBatchMode) {
                      const next = new Set(selectedStickerIndices);
                      if (next.has(idx)) next.delete(idx);
                      else next.add(idx);
                      setSelectedStickerIndices(next);
                    } else {
                      onSelectSticker(sticker);
                    }
                  }}
                  className={`aspect-square rounded-2xl border p-1.5 relative flex items-center justify-center transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-pink-500 bg-pink-50/60 ring-2 ring-pink-300'
                      : 'border-neutral-200/70 bg-neutral-50/50 hover:bg-neutral-100 hover:scale-105 active:scale-95'
                  }`}
                >
                  <img
                    src={sticker}
                    alt={`Sticker ${idx}`}
                    className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xs"
                  />

                  {/* 批量复选框 */}
                  {isBatchMode && (
                    <div className="absolute top-1 left-1 bg-white/80 rounded-full p-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-pink-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </div>
                  )}

                  {/* 非批量时的单删按钮 */}
                  {!isBatchMode && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSticker(idx, e)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-neutral-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 cursor-pointer"
                      title="删除表情包"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Emoji 页 */}
      {activeTab === 'emojis' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2">
          {/* 添加 Emoji 行与批量管理按钮 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={newEmojiInput}
              onChange={e => setNewEmojiInput(e.target.value)}
              placeholder="输入并添加新 Emoji..."
              className="flex-1 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs outline-none focus:border-neutral-400"
            />
            <button
              type="button"
              onClick={handleAddEmoji}
              disabled={!newEmojiInput.trim()}
              className="px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>添加</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEmojiBatchMode(!isEmojiBatchMode);
                if (isEmojiBatchMode) setSelectedEmojiIndices(new Set());
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isEmojiBatchMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {isEmojiBatchMode ? '退出批量' : '批量管理'}
            </button>
          </div>

          {/* 批量操作控制条 */}
          {isEmojiBatchMode && (
            <div className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-200/80 shrink-0">
              <span className="text-[10px] text-neutral-500">
                已选 {selectedEmojiIndices.size} 项 / 共 {emojis.length} 项
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEmojiIndices.size === emojis.length) {
                      setSelectedEmojiIndices(new Set());
                    } else {
                      setSelectedEmojiIndices(new Set(emojis.map((_, i) => i)));
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white border border-neutral-200 text-neutral-700 cursor-pointer"
                >
                  {selectedEmojiIndices.size === emojis.length ? '全不选' : '全选'}
                </button>
                <button
                  type="button"
                  onClick={handleBatchDeleteEmojis}
                  disabled={selectedEmojiIndices.size === 0}
                  className="px-2.5 py-0.5 rounded text-[10px] bg-rose-600 text-white font-medium disabled:opacity-40 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          )}

          {emojis.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 space-y-1 py-8">
              <Smile className="w-8 h-8 text-neutral-300" />
              <p className="text-xs font-medium text-neutral-500">暂无 Emoji</p>
              <p className="text-[10px] text-neutral-400">可在上方输入框中输入并点击添加自定义 Emoji</p>
            </div>
          ) : (
            <>
              <span className="text-[10px] text-neutral-400 block shrink-0">
                点击任意 Emoji 即可作为消息发送至聊天框：
              </span>

              {/* Emoji 网格 */}
              <div className="flex-1 overflow-y-auto grid grid-cols-7 sm:grid-cols-8 gap-2 pr-1 content-start">
                {emojis.map((emoji, idx) => {
                  const isSelected = selectedEmojiIndices.has(idx);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isEmojiBatchMode) {
                          const next = new Set(selectedEmojiIndices);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          setSelectedEmojiIndices(next);
                        } else {
                          onSelectEmoji(emoji);
                        }
                      }}
                      className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all cursor-pointer select-none relative ${
                        isSelected
                          ? 'bg-amber-100 ring-2 ring-amber-400 scale-95'
                          : 'hover:bg-neutral-100 hover:scale-125 active:scale-95'
                      }`}
                    >
                      <span>{emoji}</span>
                      {isEmojiBatchMode && (
                        <span className="absolute top-0.5 right-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-3 h-3 text-amber-700" />
                          ) : (
                            <Square className="w-3 h-3 text-neutral-300" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: 表情与Emoji规则设置开关 */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* 开关 1: 角色是否使用表情包 */}
          <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70">
            <div>
              <span className="font-semibold text-neutral-800 text-xs block">角色使用表情包</span>
              <span className="text-[10px] text-neutral-400">
                开启后，角色回复字卡后有概率附带发送表情包图片
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.stickersEnabled !== false}
              onChange={e => onUpdateSettings?.({ stickersEnabled: e.target.checked })}
              className="accent-neutral-900 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* 开关 2: 角色是否使用 Emoji */}
          <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/70">
            <div>
              <span className="font-semibold text-neutral-800 text-xs block">角色使用 Emoji</span>
              <span className="text-[10px] text-neutral-400">
                开启后，角色回复时有概率附带使用 Emoji 表情符号
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.emojisEnabled !== false}
              onChange={e => onUpdateSettings?.({ emojisEnabled: e.target.checked })}
              className="accent-neutral-900 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* 开关 3: 混合模式开关与简述说明（满足用户要求） */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-800 text-xs block">Emoji 混合模式</span>
                <span className="text-[10px] text-neutral-400">
                  控制 Emoji 与字卡文本的呈现组合方式
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.emojiMixedMode !== false}
                onChange={e => onUpdateSettings?.({ emojiMixedMode: e.target.checked })}
                className="accent-neutral-900 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="p-2 bg-white rounded-lg border border-neutral-200/60 text-[10px] text-neutral-500 leading-relaxed">
              <strong className="text-neutral-700 block mb-0.5">混合模式说明：</strong>
              • <strong>开启混合模式</strong>：Emoji 随机拼接在字卡文字的前面或后面（例如：「✨ 愿你今日明朗」或「愿你今日明朗 ✨」）。<br />
              • <strong>关闭混合模式</strong>：Emoji 将作为一条单独独立的气泡发出。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
