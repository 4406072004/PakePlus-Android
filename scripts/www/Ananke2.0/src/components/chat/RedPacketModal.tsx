import React, { useState } from 'react';
import { X, Gift, Sparkles, Heart, DollarSign } from 'lucide-react';
import { Character, PhoneSettings } from '../../types';
import { RED_PACKET_COLOR_PRESETS, getRedPacketStyle } from '../../data/redPacketPresets';

interface RedPacketModalProps {
  isOpen: boolean;
  character: Character;
  settings: PhoneSettings;
  onUpdateSettings: (settings: Partial<PhoneSettings>) => void;
  onClose: () => void;
  onSendUserRedPacket: (amount: number, remark: string, color: string) => void;
  onSendCharacterRedPacket: (amount: number, remark: string, color: string) => void;
}

export const RedPacketModal: React.FC<RedPacketModalProps> = ({
  isOpen,
  character,
  settings,
  onUpdateSettings,
  onClose,
  onSendUserRedPacket,
  onSendCharacterRedPacket,
}) => {
  const [tab, setTab] = useState<'user' | 'character'>('user');
  const [amountStr, setAmountStr] = useState('520');
  const [remark, setRemark] = useState('愿你天天开心，喜乐顺遂');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    const s = getRedPacketStyle(settings.customRedPacketColor);
    return s.id !== 'custom' ? s.id : 'sakura';
  });
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const activeStyle = getRedPacketStyle(selectedPresetId);

  // 意义非凡的预设金额与常用金额
  const meaningfulAmounts = [
    { label: '520 (我爱你)', val: '520' },
    { label: '666 (顺遂)', val: '666' },
    { label: '888 (发财)', val: '888' },
    { label: '1314 (一生一世)', val: '1314' },
    { label: '52.0', val: '52.0' },
    { label: '66.6', val: '66.6' },
    { label: '88.8', val: '88.8' },
    { label: '99.9 (长久)', val: '99.9' },
    { label: '5.20', val: '5.20' },
    { label: '13.14', val: '13.14' },
  ];

  const commonAmounts = ['6.00', '8.88', '10.00', '20.00', '50.00', '100.00', '200.00'];

  // 梦角随机金额池与文案池（去除个位数，包含常用金额与大额宠溺金额）
  const characterAmountPool = [
    13.14, 50, 52.0, 66.6, 88.8, 99.9, 100, 131.4, 200, 500,
    520, 600, 666, 800, 888, 999, 1000, 1314, 2000, 5200, 6666, 8888, 9999
  ];
  const characterRemarks = [
    '拿去买你最喜欢喝的奶茶与甜品~',
    '今天也是最喜欢你的一天',
    '专属零花钱，不许推辞哦',
    '小小心意，愿你每天都被幸福包围',
    '收下我的心意吧~',
    '给最可爱的你准备的小惊喜',
    '买束花送给今天的自己吧',
  ];

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = getRedPacketStyle(presetId);
    onUpdateSettings({ customRedPacketColor: preset.primaryColor });
  };

  const handleSendUser = () => {
    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) {
      setErrorMsg('请输入有效的红包金额');
      return;
    }

    const finalRemark = remark.trim() || '大吉大利，万事胜意';
    onSendUserRedPacket(val, finalRemark, activeStyle.primaryColor);
    onClose();
  };

  const handleSendCharacter = () => {
    const randomAmount = characterAmountPool[Math.floor(Math.random() * characterAmountPool.length)];
    const randomRemark = characterRemarks[Math.floor(Math.random() * characterRemarks.length)];
    onSendCharacterRedPacket(randomAmount, randomRemark, activeStyle.primaryColor);
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
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-2xs transition-colors"
              style={{ 
                background: activeStyle.bgGradient,
                color: activeStyle.textColor 
              }}
            >
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">发红包互动</h3>
              <p className="text-[10px] text-neutral-400">简约线条 · 半透明磨砂质感</p>
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

        {/* Tab 切换: 我发红包 / 梦角发红包 */}
        <div className="p-3 bg-neutral-50/80 border-b border-neutral-100">
          <div className="grid grid-cols-2 gap-2 bg-neutral-200/60 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => { setTab('user'); setErrorMsg(''); }}
              className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'user'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>我发红包</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('character'); setErrorMsg(''); }}
              className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'character'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span>{character.nickname || character.name}发红包</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs flex items-center justify-between">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg('')} className="p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {tab === 'user' ? (
            /* 1. 我发红包 */
            <>
              {/* 金额输入 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">红包金额 (元)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-serif text-base">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amountStr ?? ''}
                    onChange={e => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-50 border border-neutral-200/90 rounded-2xl pl-8 pr-4 py-2.5 text-sm font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-400 transition-colors"
                  />
                </div>
              </div>

              {/* 寓意金额预设 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">寓意金额快捷填入</label>
                <div className="flex flex-wrap gap-1.5">
                  {meaningfulAmounts.map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setAmountStr(m.val)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer ${
                        amountStr === m.val
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 常用金额 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">常用金额</label>
                <div className="flex flex-wrap gap-1.5">
                  {commonAmounts.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAmountStr(c)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors cursor-pointer ${
                        amountStr === c
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      ¥{c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 备注输入 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">红包寄语 / 备注</label>
                <input
                  type="text"
                  value={remark ?? ''}
                  onChange={e => setRemark(e.target.value.slice(0, 30))}
                  placeholder="恭喜发财，万事顺意"
                  className="w-full bg-neutral-50 border border-neutral-200/90 rounded-2xl px-3.5 py-2.5 text-xs text-neutral-800 focus:bg-white focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>

              {/* 预设磨砂色调选取（低饱和度，浅色底搭配深色字体） */}
              <div className="space-y-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/70">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-800 block">低饱和磨砂色调</label>
                  <span className="text-[10px] text-neutral-400">浅色底搭配深色字体</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {RED_PACKET_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        selectedPresetId === preset.id
                          ? 'ring-2 ring-neutral-800 shadow-2xs scale-102 border-transparent bg-white'
                          : 'hover:scale-101 border-neutral-200/80 bg-white/70'
                      }`}
                    >
                      <div 
                        className="w-full h-5 rounded-lg shadow-2xs border"
                        style={{ 
                          background: preset.bgGradient,
                          borderColor: preset.border,
                        }} 
                      />
                      <span className="text-[10px] font-medium text-neutral-700 leading-tight">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 实时磨砂质感与文字对比度预览条 */}
                <div 
                  className="mt-2.5 p-2.5 rounded-xl border flex items-center justify-between text-xs shadow-xs transition-colors"
                  style={{
                    background: activeStyle.bgGradient,
                    borderColor: activeStyle.border,
                    color: activeStyle.textColor,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 shrink-0" style={{ color: activeStyle.textColor }} />
                    <span className="font-medium text-[11px] truncate max-w-[170px]" style={{ color: activeStyle.textColor }}>
                      {remark || '心愿红包'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs shrink-0" style={{ color: activeStyle.textColor }}>
                    ¥{amountStr || '0'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* 2. 梦角发红包 */
            <div className="py-4 space-y-4 text-center">
              <div className="relative inline-block">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl animate-pulse transition-colors"
                  style={{
                    background: activeStyle.bgGradient,
                    color: activeStyle.textColor,
                  }}
                >
                  <Gift className="w-9 h-9" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-md">
                  <img src={character.avatar} alt="Char" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-800">
                  {character.nickname || character.name}的心意红包
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed px-4">
                  点击后，角色立刻会在随机金额池（13.14、52.0、100、500、520、1314、5200、8888、9999 等）中挑选一个数字给你发红包！
                </p>
              </div>

              {/* 色调切换 */}
              <div className="space-y-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-800 font-medium block">红包色调选择</span>
                  <span className="text-[10px] text-neutral-400">{activeStyle.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {RED_PACKET_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        selectedPresetId === preset.id
                          ? 'ring-2 ring-neutral-800 shadow-2xs scale-102 border-transparent bg-white'
                          : 'hover:scale-101 border-neutral-200/80 bg-white/70'
                      }`}
                    >
                      <div 
                        className="w-full h-4 rounded-lg shadow-2xs border"
                        style={{ 
                          background: preset.bgGradient,
                          borderColor: preset.border,
                        }} 
                      />
                      <span className="text-[9.5px] font-medium text-neutral-700 leading-tight">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
          {tab === 'user' ? (
            <button
              type="button"
              onClick={handleSendUser}
              className="flex-1 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-xs text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
              <span>发送心愿红包</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendCharacter}
              className="flex-1 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-xs text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>立刻发红包</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
