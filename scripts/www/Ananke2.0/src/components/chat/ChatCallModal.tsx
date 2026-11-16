import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Minus } from 'lucide-react';
import { Character } from '../../types';
import { ActiveCallSession, callService } from '../../core/CallService';
import { DraggableCallBubble } from './DraggableCallBubble';

interface ChatCallModalProps {
  character: Character;
  onNavigateToChat?: () => void;
}

export const ChatCallModal: React.FC<ChatCallModalProps> = ({
  character,
  onNavigateToChat,
}) => {
  const [session, setSession] = useState<ActiveCallSession | null>(() => callService.getSession());

  useEffect(() => {
    const unsub = callService.subscribe(s => {
      setSession(s);
    });
    return unsub;
  }, []);

  if (!session) return null;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. 如果处于最小化状态：显示极简可拖拽移动的小悬浮胶囊
  if (session.isMinimized) {
    if (session.status === 'connected') {
      return (
        <DraggableCallBubble
          character={character}
          session={session}
          onExpand={() => {
            if (onNavigateToChat) onNavigateToChat();
            callService.setMinimized(false);
          }}
        />
      );
    }
    // 最小化挂断或已结束时，直接不显示大弹窗，绝不弹回原窗口
    return null;
  }

  // 2. 如果已结束且准备清理，不显示大弹窗
  if (session.status === 'ended' && !session.endReason) {
    return null;
  }

  // 3. 通话大弹窗形态（非全屏，大居中卡片弹窗，美观半透明遮罩）
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none"
      onClick={(e) => {
        // 如果已接通，点击背景可以快速最小化
        if (session.status === 'connected') {
          callService.setMinimized(true);
        }
      }}
    >
      <div 
        className="w-full max-w-[340px] sm:max-w-[360px] h-[480px] max-h-[84vh] bg-gradient-to-b from-neutral-900 via-neutral-900/98 to-neutral-950 rounded-[32px] border border-white/15 shadow-2xl flex flex-col justify-between p-5 text-white animate-scale-in relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 背景微光光晕 */}
        <div className="absolute -top-20 -left-20 w-44 h-44 rounded-full bg-pink-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* 顶部控制栏 */}
        <div className="flex items-center justify-between pt-1 relative z-10">
          {session.status === 'connected' ? (
            <button
              type="button"
              onClick={() => callService.setMinimized(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-xs text-neutral-200 backdrop-blur-md transition-all cursor-pointer"
              title="窗口缩到最小并可在屏幕自由拖动"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>最小化</span>
            </button>
          ) : (
            <div className="w-16" />
          )}

          <div className="text-center">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
              {session.status === 'connected'
                ? '语音通话中'
                : session.callType === 'outgoing'
                ? '正在呼叫...'
                : '来电提醒'}
            </span>
          </div>

          <div className="w-16" />
        </div>

        {/* 中间角色头像与状态文字 */}
        <div className="flex flex-col items-center justify-center -mt-4 space-y-4 relative z-10">
          <div className="relative">
            {/* 振铃波纹动效 */}
            {session.status === 'ringing' && (
              <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping scale-125" />
            )}
            <div className="w-22 h-22 rounded-full overflow-hidden border-2 border-white/30 shadow-2xl relative z-10 bg-neutral-800">
              <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-xs">
              {character.nickname || character.name}
            </h2>
            <p className="text-xs text-neutral-300 font-medium">
              {session.status === 'ringing'
                ? session.callType === 'outgoing'
                  ? '等待对方接听...'
                  : '邀请你进行语音通话...'
                : session.status === 'connected'
                ? formatDuration(session.duration)
                : session.endReason || '通话已结束'}
            </p>
          </div>
        </div>

        {/* 底部控制按键 */}
        <div className="space-y-5 pb-3 relative z-10">
          {session.status === 'connected' && (
            <div className="flex items-center justify-center gap-7 text-neutral-300">
              <button
                type="button"
                onClick={() => callService.toggleMute()}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  session.isMuted ? 'bg-white text-neutral-900' : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={session.isMuted ? '解除静音' : '静音'}
              >
                {session.isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>

              <button
                type="button"
                onClick={() => callService.toggleSpeaker()}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  session.isSpeakerOn ? 'bg-white text-neutral-900' : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={session.isSpeakerOn ? '免提开启' : '免提关闭'}
              >
                {session.isSpeakerOn ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-10">
            {session.status === 'ringing' && session.callType === 'incoming' ? (
              <>
                {/* 拒绝来电 */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => callService.endCall('已拒绝来电', 'rejected')}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                  </button>
                  <span className="text-[10px] text-neutral-300">挂断</span>
                </div>

                {/* 接听来电 */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => callService.answerCall()}
                    className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 flex items-center justify-center shadow-lg transition-transform cursor-pointer animate-bounce"
                  >
                    <Phone className="w-6 h-6 text-white" />
                  </button>
                  <span className="text-[10px] text-neutral-300">接听</span>
                </div>
              </>
            ) : (
              /* 挂断 / 取消按钮 */
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => callService.endCall(session.status === 'ringing' ? '已取消呼叫' : '通话已结束')}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-[10px] text-neutral-300">
                  {session.status === 'ringing' ? '取消呼叫' : '结束通话'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
