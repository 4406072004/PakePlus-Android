import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Plus, Trash2, CheckCircle2, ListChecks, HelpCircle } from 'lucide-react';
import { PollData } from '../../types';
import { FontStorageService } from '../../services/FontStorageService';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPoll: (poll: PollData) => void;
}

export const PollModal: React.FC<PollModalProps> = ({
  isOpen,
  onClose,
  onSendPoll,
}) => {
  const [pollType, setPollType] = useState<'boolean' | 'custom'>('boolean');
  const [isMultiple, setIsMultiple] = useState(false);
  const [question, setQuestion] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customOptions, setCustomOptions] = useState<string[]>(['选项A', '选项B']);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await FontStorageService.compressBackgroundImage(file);
      setImagePreview(compressed);
    } catch (err) {
      setErrorMsg('图片压缩失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsCompressing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleAddOption = () => {
    if (customOptions.length >= 8) return;
    setCustomOptions([...customOptions, `选项${String.fromCharCode(65 + customOptions.length)}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const next = [...customOptions];
    next[index] = val;
    setCustomOptions(next);
  };

  const handleSend = () => {
    if (!question.trim()) {
      setErrorMsg('请输入问卷问题');
      return;
    }

    let finalOptions: string[];
    if (pollType === 'boolean') {
      finalOptions = ['是', '否'];
    } else {
      const filtered = customOptions.map(o => o.trim()).filter(Boolean);
      if (filtered.length < 2) {
        setErrorMsg('请至少填写两个有效选项');
        return;
      }
      finalOptions = filtered;
    }

    const newPoll: PollData = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: pollType,
      isMultiple: pollType === 'custom' ? isMultiple : false,
      question: question.trim(),
      imageUrl: imagePreview || undefined,
      options: finalOptions,
      completed: false,
    };

    onSendPoll(newPoll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
      <div 
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center">
              <ListChecks className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">发起问卷互动</h3>
              <p className="text-[10px] text-neutral-400">发到聊天框，5秒后梦角将完成选择</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center justify-between">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg('')} className="p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 问卷类型切换 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">问卷形式</label>
            <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setPollType('boolean')}
                className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  pollType === 'boolean'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>是否问卷 (固定是非)</span>
              </button>
              <button
                type="button"
                onClick={() => setPollType('custom')}
                className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  pollType === 'custom'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>选择问卷 (自定义)</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 px-1">
              {pollType === 'boolean'
                ? '包含固定选项“是”与“否”，梦角各有 50% 概率选择。'
                : '自定义选项，每条选项选到的概率均等。'}
            </p>
          </div>

          {/* 若为自定义选择问卷，支持单选/多选切换 */}
          {pollType === 'custom' && (
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-2xl border border-neutral-100">
              <div>
                <span className="text-xs text-neutral-800 font-medium block">选择模式</span>
                <span className="text-[10px] text-neutral-400">
                  {isMultiple ? '多选模式：梦角可同时选中多个符合的心愿选项' : '单选模式：梦角在各选项中等概率挑选其一'}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-200/80 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsMultiple(false)}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    !isMultiple ? 'bg-white text-neutral-900 font-medium shadow-2xs' : 'text-neutral-500'
                  }`}
                >
                  单选
                </button>
                <button
                  type="button"
                  onClick={() => setIsMultiple(true)}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    isMultiple ? 'bg-white text-neutral-900 font-medium shadow-2xs' : 'text-neutral-500'
                  }`}
                >
                  多选
                </button>
              </div>
            </div>
          )}

          {/* 问题输入 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">问卷问题 <span className="text-rose-500">*</span></label>
              <span className="text-[10px] text-neutral-400">{question.length}/60</span>
            </div>
            <textarea
              value={question ?? ''}
              onChange={e => setQuestion(e.target.value.slice(0, 60))}
              placeholder="例如：今晚想吃火锅还是烤肉？/ 明天一起出门好吗？"
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200/90 rounded-2xl p-3 text-xs text-neutral-800 focus:bg-white focus:outline-none focus:border-neutral-400 transition-colors resize-none"
            />
          </div>

          {/* 插入图片（可选，仅允许一张） */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">插入图片 (可选，仅允许一张)</label>
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-neutral-200 w-full h-32 group">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  title="删除图片"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full py-3 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-2xl flex items-center justify-center gap-2 text-xs text-neutral-500 hover:text-neutral-700 bg-neutral-50/50 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4 text-neutral-400" />
                <span>{isCompressing ? '压缩处理中...' : '点击上传插图 (限一张)'}</span>
              </button>
            )}
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* 选项配置 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 block">问卷选项</label>
            {pollType === 'boolean' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-800">是</span>
                  <span className="text-[10px] text-neutral-400">概率 50%</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-800">否</span>
                  <span className="text-[10px] text-neutral-400">概率 50%</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {customOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 text-[11px] font-bold text-neutral-400 text-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <input
                      type="text"
                      value={opt ?? ''}
                      onChange={e => handleOptionChange(idx, e.target.value)}
                      placeholder={`选项 ${idx + 1}`}
                      className="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-xl px-3 py-1.5 text-xs text-neutral-800 focus:bg-white focus:outline-none focus:border-neutral-400"
                    />
                    <span className="text-[10px] text-neutral-400 shrink-0">
                      {(100 / customOptions.length).toFixed(0)}%
                    </span>
                    {customOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {customOptions.length < 8 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="w-full py-1.5 text-xs text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100/80 rounded-xl flex items-center justify-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加选项 (最多8个)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-700 font-medium transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="flex-1 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-xs text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>发送问卷</span>
          </button>
        </div>
      </div>
    </div>
  );
};
