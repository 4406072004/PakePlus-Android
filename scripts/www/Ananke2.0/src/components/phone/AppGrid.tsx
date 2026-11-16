import React from 'react';
import { 
  Camera, 
  Mail, 
  HeartHandshake, 
  HeartPulse, 
  Wallet, 
  Settings 
} from 'lucide-react';
import { PhoneSettings } from '../../types';

export type AppPageId = 'home' | 'chat' | 'moments' | 'mailbox' | 'companion' | 'sleep' | 'ledger' | 'settings';

interface AppGridProps {
  settings: PhoneSettings;
  onOpenApp: (appId: AppPageId) => void;
  unreadLettersCount?: number;
  isCompanionActive?: boolean;
}

interface AppDef {
  id: AppPageId;
  name: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badge?: number;
}

export const AppGrid: React.FC<AppGridProps> = ({
  settings,
  onOpenApp,
  unreadLettersCount = 0,
  isCompanionActive = false,
}) => {
  const apps: AppDef[] = [
    { id: 'moments', name: '朋友圈', icon: Camera },
    { id: 'mailbox', name: '信箱', icon: Mail, badge: unreadLettersCount },
    { id: 'companion', name: '陪伴', icon: HeartHandshake },
    { id: 'sleep', name: '健康', icon: HeartPulse },
    { id: 'ledger', name: '记账', icon: Wallet },
    { id: 'settings', name: '设置', icon: Settings },
  ];

  // Dynamic icon container style
  const getIconContainerStyle = (): React.CSSProperties => {
    return {
      backgroundColor: settings.iconBgColor || '#ffffff',
      opacity: settings.iconOpacity ?? 0.95,
      borderRadius: `${settings.iconRadius ?? 18}px`,
    };
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center py-2 select-none">
      {/* 2 Rows × 3 Columns layout with generous ergonomic spacing */}
      <div className="grid grid-cols-3 gap-y-5 gap-x-4 px-2 items-center justify-items-center">
        {apps.map(app => {
          const IconComponent = app.icon;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => onOpenApp(app.id)}
              className="flex flex-col items-center justify-center group cursor-pointer active:scale-95 transition-all duration-150 relative"
              title={`打开${app.name}`}
            >
              {/* Icon Box */}
              <div
                className="w-14 h-14 sm:w-15 sm:h-15 flex items-center justify-center shadow-xs border border-neutral-200/60 transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5 relative"
                style={getIconContainerStyle()}
              >
                <IconComponent
                  className="w-6 h-6 transition-colors"
                  style={{ color: settings.iconTextColor || '#27272a' }}
                />

                {/* Badge if present */}
                {Boolean(app.badge && app.badge > 0) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {app.badge}
                  </span>
                )}

                {/* 正在进行陪伴模式时的显著角标提示 */}
                {app.id === 'companion' && isCompanionActive && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-bold rounded-full shadow-md flex items-center gap-1 animate-pulse z-10 border border-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>陪伴中</span>
                  </span>
                )}
              </div>

              {/* App Label */}
              <span
                className="mt-1.5 text-[11px] font-normal tracking-wide text-neutral-800 transition-colors group-hover:text-neutral-950"
              >
                {app.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
