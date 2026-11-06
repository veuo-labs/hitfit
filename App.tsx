/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import DinoGame from './components/DinoGame';
import { OnboardingModal } from './components/OnboardingModal';
import { ProgressModal } from './components/ProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UserProfile, getUserProfile } from './services/fitnessEngine';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!profile.onboarded);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<'standard' | 'high' | 'low'>('standard');

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
  };

  const handleOnboardingComplete = (updated: UserProfile, stream?: MediaStream | null) => {
    setProfile(updated);
    if (stream) {
      setCameraStream(stream);
    }
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-3 sm:p-5 md:p-6 bg-hitfit-bg text-hitfit-text font-serif select-none">
      
      {/* HEADER & COMPACT RESPONSIVE TOOLBAR */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-3 mb-3 md:mb-5 border-b border-hitfit-border pb-3">
        {/* Brand */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-hitfit-accent inline-block"></span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold tracking-tight text-hitfit-text">
              HitFit
            </h1>
          </div>
          <span className="text-[11px] sm:text-xs text-hitfit-muted italic">
            Hit the target to be fit.
          </span>
        </div>

        {/* Toolbar Navigation Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowAbout(true)}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            About
          </button>

          <button
            onClick={() => setShowProgress(true)}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Progress
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Settings
          </button>

          <PWAInstallButton />
        </div>
      </header>

      {/* MAIN GAME CONTAINER */}
      <main className="w-full max-w-4xl flex flex-col items-center justify-center flex-1 my-auto">
        <DinoGame
          profile={profile}
          onOpenProgress={() => setShowProgress(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAbout={() => setShowAbout(true)}
          preloadedStream={cameraStream}
          soundEnabled={soundEnabled}
          onStreamReady={(s) => setCameraStream(s)}
        />
      </main>

      {/* FOOTER WITH AUTHOR CREDITS & LOCAL PRIVACY BADGE */}
      <footer className="w-full max-w-4xl mt-4 pt-3 border-t border-hitfit-border/60 text-[11px] sm:text-xs text-hitfit-muted flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <span>By </span>
          <a
            href="https://zainaxes.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hitfit-text font-semibold hover:text-hitfit-accent transition-colors"
          >
            Zain Ul Abidin (zainaxes)
          </a>
          <span className="mx-1.5 text-hitfit-border">·</span>
          <span>100% on-device vision</span>
        </div>

        <div>
          <a
            href="https://hitfit.zainaxes.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-hitfit-accent transition-colors"
          >
            hitfit.zainaxes.com
          </a>
        </div>
      </footer>

      {/* ONBOARDING MODAL (FIRST VISIT) */}
      {showOnboarding && (
        <OnboardingModal
          initialProfile={profile}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* ABOUT MODAL (CREDITS & PORTFOLIO) */}
      {showAbout && (
        <AboutModal
          onClose={() => setShowAbout(false)}
        />
      )}

      {/* TODAY'S PROGRESS MODAL */}
      {showProgress && (
        <ProgressModal
          profile={profile}
          onClose={() => setShowProgress(false)}
        />
      )}

      {/* SETTINGS MODAL (CAMERA, SOUND, WEIGHT & REMINDERS) */}
      {showSettings && (
        <SettingsModal
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setShowSettings(false)}
          soundEnabled={soundEnabled}
          onToggleSound={setSoundEnabled}
          sensitivity={sensitivity}
          onChangeSensitivity={setSensitivity}
          videoStream={cameraStream}
        />
      )}

      {/* OFFLINE STATUS BANNER */}
      <OfflineIndicator />
    </div>
  );
};

export default App;