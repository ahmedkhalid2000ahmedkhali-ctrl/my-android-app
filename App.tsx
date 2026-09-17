import { useState, useEffect } from 'react';
import { ScreenType, ThemeMode, UserProfile } from './types';
import { authService } from './services/authService';
import { WelcomeScreen } from './components/WelcomeScreen';
import { JoinSdaScreen } from './components/JoinSdaScreen';
import { HomeScreen } from './components/HomeScreen';
import { MushafSection } from './components/MushafSection';
import { PrayerTimesScreen } from './components/PrayerTimesScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SplashScreen } from './components/SplashScreen';
import { AdhkarScreen } from './components/AdhkarScreen';
import { HadithScreen } from './components/HadithScreen';
import { QuranRadioScreen } from './components/QuranRadioScreen';
import { ReligiousStoriesScreen } from './components/ReligiousStoriesScreen';
import { DigitalMasbahaScreen } from './components/DigitalMasbahaScreen';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { BottomNav } from './components/BottomNav';
import { Smartphone, Monitor, Download } from 'lucide-react';
import { cloudSyncService } from './services/cloudSyncService';

export default function App() {
  // Session initialization
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = authService.getActiveSession();
    return (
      saved || {
        id: 'guest_sda_user',
        name: 'ضيف زاد الروح',
        provider: 'guest',
        joinedAt: new Date().toISOString(),
      }
    );
  });

  // First screen to appear after launching is strictly the elegant Welcome Screen as requested in Requirement 1
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [selectedRadioSurahNumber, setSelectedRadioSurahNumber] = useState<number | undefined>(undefined);
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(true);
  const [frameMode, setFrameMode] = useState<'phone' | 'full'>('phone');

  // Listen to system prefers-color-scheme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Check URL query parameters and listen to SW message on launch
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('screen') === 'adhkar') {
        setCurrentScreen('adhkar');
      }
    } catch {}

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TO_ADHKAR_REMINDER') {
        setCurrentScreen('adhkar');
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    return () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Trigger cloud sync whenever an authenticated user signs in or starts a session
  useEffect(() => {
    if (
      currentUser?.id &&
      currentUser.provider !== 'guest' &&
      currentUser.id !== 'guest_sda_user'
    ) {
      cloudSyncService.fullSync(currentUser.id);
    }
  }, [currentUser?.id, currentUser?.provider]);

  const isDark = themeMode === 'auto' ? systemIsDark : themeMode === 'dark';

  // Handle Guest Login from Welcome or Join Screen
  const handleGuestLogin = () => {
    const guest = authService.loginAsGuest();
    setCurrentUser(guest);
    setCurrentScreen('home');
  };

  // Handle Successful Auth (Phone, Google, Facebook) -> Navigate immediately to Home (Requirement 3)
  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentScreen('home');
  };

  // Handle Logout -> Clear session and return to Welcome Screen
  const handleLogout = () => {
    authService.logout();
    const guestUser: UserProfile = {
      id: 'guest_sda_user',
      name: 'ضيف زاد الروح',
      provider: 'guest',
      joinedAt: new Date().toISOString(),
    };
    setCurrentUser(guestUser);
    setCurrentScreen('welcome');
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-center transition-colors duration-500 relative ${
        isDark ? 'bg-[#050806]' : 'bg-[#eef2ef]'
      }`}
    >
      {/* Desktop Helper Toggle: Allows user to view as Phone Bezel Frame or Full Width on desktop */}
      <div className="hidden lg:flex fixed top-3 left-4 z-50 items-center gap-2 p-1.5 rounded-xl backdrop-blur-md border border-[#c5a059]/30 bg-black/40 text-stone-300 text-xs">
        <span className="text-[11px] text-[#c5a059] px-1 font-medium">عرض الشاشة:</span>
        <button
          onClick={() => setFrameMode('phone')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            frameMode === 'phone'
              ? 'bg-[#064e3b] text-white border border-[#c5a059]/40'
              : 'hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>هاتف</span>
        </button>
        <button
          onClick={() => setFrameMode('full')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            frameMode === 'full'
              ? 'bg-[#064e3b] text-white border border-[#c5a059]/40'
              : 'hover:text-white'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>ملء الشاشة</span>
        </button>

        <span className="w-px h-4 bg-stone-700 mx-1" />

        <a
          href="/api/download-zip"
          download="zad-alrouh.zip"
          title="تحميل كود المشروع بصيغة ZIP مباشرة"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#064e3b]/80 hover:bg-[#064e3b] text-[#c5a059] border border-[#c5a059]/40 transition-all font-bold cursor-pointer shadow-sm active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تنزيل ZIP للمشروع</span>
        </a>
      </div>

      {/* Main App Container (Adaptive Phone Container on large screens, 100% on mobile) */}
      <div
        className={`w-full transition-all duration-300 relative ${
          frameMode === 'phone'
            ? 'max-w-[440px] lg:my-6 lg:rounded-[36px] lg:shadow-2xl lg:shadow-black/60 lg:border lg:border-[#c5a059]/25 overflow-hidden'
            : 'w-full'
        } ${isDark ? 'bg-[#090d0b]' : 'bg-[#f7f9f7]'}`}
      >
        {/* 1. Welcome Screen (First screen user sees upon launch - Requirement 1) */}
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            onJoinSda={() => setCurrentScreen('join_sda')}
            onContinueAsGuest={handleGuestLogin}
            isDark={isDark}
          />
        )}

        {/* 2. Join SDA Screen (Phone without OTP, Google, Facebook, Guest - Requirement 2) */}
        {currentScreen === 'join_sda' && (
          <JoinSdaScreen
            onSuccess={handleAuthSuccess}
            onGuest={handleGuestLogin}
            onBackToWelcome={() => setCurrentScreen('welcome')}
            isDark={isDark}
          />
        )}

        {/* 3. Main Home Screen (With new Mushaf section, no login button in header - Requirements 4 & 5) */}
        {currentScreen === 'home' && (
          <HomeScreen
            onNavigateToSettings={() => setCurrentScreen('settings')}
            onNavigateToMushaf={() => setCurrentScreen('mushaf')}
            onNavigateToPrayerTimes={() => setCurrentScreen('prayer_times')}
            onNavigateToAdhkar={() => setCurrentScreen('adhkar')}
            onNavigateToHadith={() => setCurrentScreen('hadith')}
            onNavigateToQuranRadio={() => {
              setSelectedRadioSurahNumber(undefined);
              setCurrentScreen('quran_radio');
            }}
            onNavigateToReligiousStories={() => setCurrentScreen('religious_stories')}
            onNavigateToMasbaha={() => setCurrentScreen('digital_masbaha')}
            currentUser={currentUser}
            isDark={isDark}
          />
        )}

        {/* 4. Complete Mushaf Section (114 Surahs, Index, Reader skeleton, Progress saving - Requirements 5 & 6) */}
        {currentScreen === 'mushaf' && (
          <MushafSection
            currentUser={currentUser}
            onJoinSdaPrompt={() => setCurrentScreen('join_sda')}
            onBackToHome={() => setCurrentScreen('home')}
            onNavigateToRadio={(surahNum) => {
              setSelectedRadioSurahNumber(surahNum);
              setCurrentScreen('quran_radio');
            }}
            isDark={isDark}
          />
        )}

        {/* 4.5. Prayer Times Section (المؤذن ومواقيت الصلاة - المرحلة الأولى) */}
        {currentScreen === 'prayer_times' && (
          <PrayerTimesScreen
            currentUser={currentUser}
            onBackToHome={() => setCurrentScreen('home')}
            onNavigateToSettings={() => setCurrentScreen('settings')}
            isDark={isDark}
          />
        )}

        {/* 4.7. Adhkar Section (الأذكار - المراحل 5-A, 5-B, 5-C) */}
        {currentScreen === 'adhkar' && (
          <AdhkarScreen
            currentUser={currentUser}
            onBackToHome={() => setCurrentScreen('home')}
            isDark={isDark}
          />
        )}

        {/* 4.8. Hadith Section (الأحاديث والسنة - المرحلة السادسة) */}
        {currentScreen === 'hadith' && (
          <HadithScreen
            currentUser={currentUser}
            onBackToHome={() => setCurrentScreen('home')}
            isDark={isDark}
          />
        )}

        {/* 4.9. Quran Radio & Recitations Section (إذاعة القرآن الكريم والتلاوات - المرحلة السادسة) */}
        {currentScreen === 'quran_radio' && (
          <QuranRadioScreen
            currentUser={currentUser}
            isDark={isDark}
            onBack={() => setCurrentScreen('home')}
            initialSurahNumber={selectedRadioSurahNumber}
          />
        )}

        {/* 4.10. Religious Stories Section (قصص دينية موثقة) */}
        {currentScreen === 'religious_stories' && (
          <ReligiousStoriesScreen
            currentUser={currentUser}
            onBackToHome={() => setCurrentScreen('home')}
            isDark={isDark}
          />
        )}

        {/* 4.11. Digital Masbaha Section (المسبحة الإلكترونية) */}
        {currentScreen === 'digital_masbaha' && (
          <DigitalMasbahaScreen
            currentUser={currentUser}
            onBackToHome={() => setCurrentScreen('home')}
            isDark={isDark}
          />
        )}

        {/* 5. Settings Screen (Account info, Logout, Theme toggle - Requirement 4) */}
        {currentScreen === 'settings' && (
          <SettingsScreen
            themeMode={themeMode}
            onSetThemeMode={setThemeMode}
            currentUser={currentUser}
            onLogout={handleLogout}
            onJoinSda={() => setCurrentScreen('join_sda')}
            onNavigateToProfile={() => setCurrentScreen('profile')}
            onReplaySplash={() => setCurrentScreen('welcome')}
            onNavigateHome={() => setCurrentScreen('home')}
            isDark={isDark}
          />
        )}

        {/* 6. Profile Screen (View and edit user details, avatar, linked phone and social accounts - Requirement 3) */}
        {currentScreen === 'profile' && (
          <ProfileScreen
            currentUser={currentUser}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onBack={() => setCurrentScreen('settings')}
            isDark={isDark}
          />
        )}

        {/* Optional Splash Screen preview */}
        {currentScreen === 'splash' && (
          <SplashScreen
            onEnter={() => setCurrentScreen('welcome')}
            isDark={isDark}
          />
        )}

        {/* Floating Mini Audio Player for Background Audio Control across the entire app */}
        <MiniAudioPlayer
          onOpenPlayer={() => setCurrentScreen('quran_radio')}
          isDark={isDark}
          isVisible={
            currentScreen !== 'quran_radio' &&
            currentScreen !== 'welcome' &&
            currentScreen !== 'join_sda' &&
            currentScreen !== 'splash'
          }
        />

        {/* Bottom Navigation (Home, Mushaf, Settings) */}
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          isDark={isDark}
        />
      </div>
    </div>
  );
}
