import React, { useState, useRef } from 'react';
import { MoreHorizontal, Camera, Check } from 'lucide-react';
import { UserProfile, Character } from '../../types';
import { CARD_BG_PRESETS } from '../../data/defaultThemes';
import { PRESET_AVATARS, fileToBase64, FALLBACK_AVATAR } from '../../utils/imageUpload';
import { getCardBackgroundStyle } from '../../utils/themeStyles';

interface TopCardProps {
  userProfile: UserProfile;
  character: Character;
  cardOpacity?: number;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
  onEnterChat: () => void;
}

export const TopCard: React.FC<TopCardProps> = ({
  userProfile,
  character,
  cardOpacity = 1.0,
  onUpdateUserProfile,
  onUpdateCharacter,
  onEnterChat,
}) => {
  const [showBgModal, setShowBgModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState<'user' | 'character' | null>(null);
  const [userNameInput, setUserNameInput] = useState(userProfile?.name || '我');
  const [partnerNicknameInput, setPartnerNicknameInput] = useState(character?.nickname || character?.name || 'TA');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const cardBgStyle = getCardBackgroundStyle(userProfile?.topCardBackground, cardOpacity);

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        onUpdateUserProfile({ topCardBackground: `url(${base64})` });
        setShowBgModal(false);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        if (showAvatarModal === 'user') {
          onUpdateUserProfile({ avatar: base64 });
        } else if (showAvatarModal === 'character') {
          onUpdateCharacter({ avatar: base64 });
        }
        setShowAvatarModal(null);
      } catch (err) {
        console.error('Avatar upload failed:', err);
      }
    }
  };

  const saveUserName = () => {
    if (userNameInput.trim()) {
      onUpdateUserProfile({ name: userNameInput.trim() });
    }
    setShowAvatarModal(null);
  };

  const saveCharacterNickname = () => {
    if (partnerNicknameInput.trim()) {
      onUpdateCharacter({ nickname: partnerNicknameInput.trim(), name: partnerNicknameInput.trim() });
    }
    setShowAvatarModal(null);
  };

  return (
    <div 
      className="relative w-full h-[30%] min-h-[165px] max-h-[210px] rounded-3xl p-4 shadow-sm border border-neutral-200/70 flex flex-col justify-between overflow-hidden transition-all duration-300 select-none group"
      style={cardBgStyle}
    >
      {/* Soft overlay if background is image */}
      {userProfile.topCardBackground?.startsWith('url') && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] pointer-events-none" />
      )}

      {/* Center section: Left Avatar (Character) -- Line-drawn Pink Heart -- Right Avatar (User "我") */}
      <div className="relative z-10 flex items-center justify-between px-2 my-auto">
        {/* Left Avatar: Character */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPartnerNicknameInput(character.nickname || character.name);
              setShowAvatarModal('character');
            }}
            className="relative group/avatar cursor-pointer"
            title="点击更换对方头像与昵称"
          >
            <div className="w-14 h-14 rounded-full p-0.5 bg-white shadow-xs border border-neutral-200/80 overflow-hidden transition-transform duration-200 active:scale-95 hover:border-pink-300">
              <img
                src={character.avatar}
                alt={character.name}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_AVATAR;
                }}
              />
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-neutral-900/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Camera className="w-2.5 h-2.5" />
            </div>
          </button>
          <span className="text-[11px] text-neutral-600 font-medium max-w-[64px] truncate text-center">
            {character.nickname || character.name}
          </span>
        </div>

        {/* Center Connecting Heart & Line */}
        <div className="flex-1 flex flex-col items-center justify-center px-2">
          <div className="w-full flex items-center justify-center relative">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-pink-300/60 to-pink-400/80" />
            <button
              type="button"
              onClick={onEnterChat}
              className="mx-2 p-1.5 rounded-full cursor-pointer relative group/heart transition-transform duration-200 active:scale-90 hover:scale-105"
              title="进入聊天"
            >
              {/* Line-drawn Light Pink Heart - 纯外轮廓线条，里面空白无图案，尺寸稍大 */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-9 h-9 text-pink-400 drop-shadow-xs transition-colors group-hover:text-pink-500"
              >
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-pink-300/60 to-pink-400/80" />
          </div>

          <button
            type="button"
            onClick={onEnterChat}
            className="mt-1 text-[10px] text-neutral-400 font-light tracking-widest hover:text-pink-500 transition-colors cursor-pointer"
          >
            命运由此展开
          </button>
        </div>

        {/* Right Avatar: User ("我") */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setUserNameInput(userProfile.name);
              setShowAvatarModal('user');
            }}
            className="relative group/avatar cursor-pointer"
            title="点击更换我的头像与昵称"
          >
            <div className="w-14 h-14 rounded-full p-0.5 bg-white shadow-xs border border-neutral-200/80 overflow-hidden transition-transform duration-200 active:scale-95 hover:border-pink-300">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_AVATAR;
                }}
              />
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-neutral-900/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Camera className="w-2.5 h-2.5" />
            </div>
          </button>
          <span className="text-[11px] text-neutral-600 font-medium max-w-[64px] truncate text-center">
            {userProfile.name}
          </span>
        </div>
      </div>

      {/* Card bottom: Right three dots for background */}
      <div className="relative z-10 flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={() => setShowBgModal(true)}
          className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 transition-colors cursor-pointer"
          title="更换卡片底图"
          aria-label="更换卡片底图"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* --- Modal 1: Change Card Background --- */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-800">更换上卡片底图</h3>
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
                        onUpdateUserProfile({ topCardBackground: preset.value });
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
                    onUpdateUserProfile({ topCardBackground: '#ffffff' });
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

      {/* --- Modal 2: Change Avatar & Nickname with Save button exiting edit --- */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-neutral-200 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-800">
                {showAvatarModal === 'user' ? '修改我的昵称与头像' : '修改对方昵称与头像'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(null)}
                className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1"
              >
                关闭
              </button>
            </div>

            <div className="py-4 space-y-4">
              {showAvatarModal === 'user' ? (
                <div>
                  <label className="text-xs font-medium text-neutral-500 block mb-1.5">我的昵称</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userNameInput ?? ''}
                      onChange={e => setUserNameInput(e.target.value)}
                      placeholder="我的昵称"
                      maxLength={15}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={saveUserName}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-neutral-500 block mb-1.5">对方昵称</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={partnerNicknameInput ?? ''}
                      onChange={e => setPartnerNicknameInput(e.target.value)}
                      placeholder="对方昵称"
                      maxLength={15}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={saveCharacterNickname}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">预设手绘头像</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AVATARS.map((avatarUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (showAvatarModal === 'user') {
                          onUpdateUserProfile({ avatar: avatarUrl });
                        } else {
                          onUpdateCharacter({ avatar: avatarUrl });
                        }
                        setShowAvatarModal(null);
                      }}
                      className="w-12 h-12 rounded-full border border-neutral-200 overflow-hidden hover:scale-105 active:scale-95 transition-transform mx-auto cursor-pointer"
                    >
                      <img src={avatarUrl} alt="Preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 block mb-2">上传本地照片</label>
                <input
                  type="file"
                  ref={avatarFileRef}
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-neutral-300 rounded-xl text-xs font-medium text-neutral-600 hover:border-neutral-500 hover:bg-neutral-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  从本地相册上传自定义头像
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
