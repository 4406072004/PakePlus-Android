import React from 'react';
import { UserProfile, Character, PhoneSettings } from '../types';
import { TopCard } from '../components/phone/TopCard';
import { QuoteCard } from '../components/phone/QuoteCard';
import { MeetDaysCard } from '../components/phone/MeetDaysCard';
import { WeatherCard } from '../components/phone/WeatherCard';
import { AppGrid, AppPageId } from '../components/phone/AppGrid';

interface HomeScreenProps {
  userProfile: UserProfile;
  character: Character;
  settings: PhoneSettings;
  onUpdateUserProfile: (updates: Partial<UserProfile>) => void;
  onUpdateCharacter: (updates: Partial<Character>) => void;
  onUpdateSettings?: (updates: Partial<PhoneSettings>) => void;
  onOpenApp: (appId: AppPageId) => void;
  unreadLettersCount?: number;
  isCompanionActive?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userProfile,
  character,
  settings,
  onUpdateUserProfile,
  onUpdateCharacter,
  onUpdateSettings,
  onOpenApp,
  unreadLettersCount = 0,
  isCompanionActive = false,
}) => {
  const cardOpacity = settings.cardOpacity ?? 1.0;
  const isWeatherEnabled = settings.showWeatherCard !== false;

  return (
    <div className="w-full h-full flex flex-col justify-between px-4 py-2 relative overflow-hidden select-none">
      {/* 1. 第1个卡片 (TopCard) */}
      <TopCard
        userProfile={userProfile}
        character={character}
        cardOpacity={cardOpacity}
        onUpdateUserProfile={onUpdateUserProfile}
        onUpdateCharacter={onUpdateCharacter}
        onEnterChat={() => onOpenApp('chat')}
      />

      {/* 2. 第2个卡片 (QuoteCard - 长度与第1个卡片保持一致，宽度全宽 w-full) */}
      <div className="my-2 w-full">
        <QuoteCard
          userProfile={userProfile}
          cardOpacity={cardOpacity}
          onUpdateUserProfile={onUpdateUserProfile}
        />
      </div>

      {/* 3. 第3个卡片 (分成两个比例一致的卡片：左边相爱天数，右边梦角当日天气；支持设置中手动关闭) */}
      <div className="mb-2 w-full">
        {isWeatherEnabled ? (
          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="min-w-0">
              <MeetDaysCard
                userProfile={userProfile}
                character={character}
                cardOpacity={cardOpacity}
                onUpdateUserProfile={onUpdateUserProfile}
              />
            </div>
            <div className="min-w-0">
              <WeatherCard
                cardOpacity={cardOpacity}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onOpenSettings={() => onOpenApp('settings')}
              />
            </div>
          </div>
        ) : (
          <MeetDaysCard
            userProfile={userProfile}
            character={character}
            cardOpacity={cardOpacity}
            onUpdateUserProfile={onUpdateUserProfile}
          />
        )}
      </div>

      {/* 4. 软件图标网格 */}
      <AppGrid
        settings={settings}
        onOpenApp={onOpenApp}
        unreadLettersCount={unreadLettersCount}
        isCompanionActive={isCompanionActive}
      />
    </div>
  );
};
