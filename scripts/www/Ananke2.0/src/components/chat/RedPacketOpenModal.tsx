import React, { useState } from 'react';
import { X, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import { RedPacketData, Character, UserProfile } from '../../types';
import { getRedPacketStyle } from '../../data/redPacketPresets';

interface RedPacketOpenModalProps {
  packet: RedPacketData;
  character: Character;
  userProfile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpen: (packetId: string) => void;
}

export const RedPacketOpenModal: React.FC<RedPacketOpenModalProps> = ({
  packet,
  character,
  userProfile,
  isOpen,
  onClose,
  onOpen,
}) => {
  const [isOpeningAnim, setIsOpeningAnim] = useState(false);

  if (!isOpen) return null;

  const isSenderUser = packet.sender === 'user';
  const senderName = isSenderUser ? userProfile.name : (character.nickname || character.name);
  const senderAvatar = isSenderUser ? userProfile.avatar : character.avatar;
  const style = getRedPacketStyle(packet.color);

  const handleOpenClick = () => {
    setIsOpeningAnim(true);
    setTimeout(() => {
      setIsOpeningAnim(false);
      onOpen(packet.id);
    }, 600);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xs rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-2xl border transition-all animate-scale-in"
        style={{
          background: style.bgGradient,
          borderColor: style.border,
          color: style.textColor,
          backdropFilter: 'blur(16px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 背景装饰微光线条 */}
        <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-white/30 blur-xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-white/20 blur-xl pointer-events-none" />

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: style.textColor }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 发送者头像 */}
        <div 
          className="w-16 h-16 rounded-full overflow-hidden border-2 shadow-lg mb-3"
          style={{ borderColor: style.border }}
        >
          <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
        </div>

        {/* 发送者昵称与寄语 */}
        <div className="space-y-1 mb-5">
          <h4 className="text-sm font-bold" style={{ color: style.textColor }}>
            {senderName} 的心意红包
          </h4>
          <p className="text-xs font-medium px-2 leading-relaxed" style={{ color: style.subTextColor }}>
            {packet.remark || '大吉大利，心想事成'}
          </p>
        </div>

        {/* 红包状态：未领取 / 已领取 */}
        {packet.isOpened ? (
          <div className="space-y-3 w-full animate-fade-in">
            <div className="py-2">
              <span className="text-3xl font-extrabold tracking-tight font-serif drop-shadow-xs" style={{ color: style.textColor }}>
                ¥ {packet.amount.toFixed(2)}
              </span>
            </div>
            <div 
              className="flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 px-3 rounded-full border shadow-2xs"
              style={{ 
                backgroundColor: style.badgeBg,
                borderColor: style.border,
                color: style.textColor 
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>已存入零钱包 · {isSenderUser ? '梦角已领取' : '已领取'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full flex flex-col items-center">
            {/* 拆红包金币交互按钮 */}
            <button
              type="button"
              onClick={handleOpenClick}
              disabled={isOpeningAnim}
              className={`w-18 h-18 rounded-full bg-white text-neutral-900 shadow-2xl flex items-center justify-center border-4 transition-transform cursor-pointer ${
                isOpeningAnim ? 'animate-spin scale-110' : 'hover:scale-105 active:scale-95'
              }`}
              style={{ borderColor: style.border }}
              title="拆开红包"
            >
              <Gift className="w-8 h-8 text-pink-500" />
            </button>
            <span className="text-[11px] font-medium" style={{ color: style.subTextColor }}>
              点击拆开红包
            </span>
          </div>
        )}

        {/* 底部简约线条质感小标注 */}
        <div 
          className="mt-6 pt-3 border-t w-full flex items-center justify-center gap-1 text-[10px]"
          style={{ 
            borderColor: style.border,
            color: style.subTextColor 
          }}
        >
          <Sparkles className="w-3 h-3" />
          <span>简约磨砂红包 · {style.name}</span>
        </div>
      </div>
    </div>
  );
};

