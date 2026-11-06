/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import DinoGame from './components/DinoGame';
import { OnboardingModal } from './components/OnboardingModal';
import { ProgressModal } from './components/ProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UserProfile, getUserProfile } from './services/fitnessEngine';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!profile.onboarded);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

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
    <div className="min-h-screen flex flex-col items-center justify-between p-4 md:p-6 bg-hitfit-bg text-hitfit-text font-serif select-none">
      
      {/* HEADER & TOP CONTROLS */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-hitfit-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-hitfit-accent inline-block"></span>
            <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-hitfit-text">
              HitFit
            </h1>
          </div>
          <p className="text-xs text-hitfit-muted mt-1 italic">
            Hit the target to be fit.
          </p>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowProgress(true)}
            className="px-3.5 py-1.5 text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
            title="View today's exercise progress and history"
          >
            Progress
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="px-3.5 py-1.5 text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
            title="Edit profile, body weight, goals, and daily reminders"
          >
            Settings
          </button>

          <PWAInstallButton />
        </div>
      </header>

      {/* MAIN GAME CONTAINER */}
      <main className="w-full max-w-4xl flex flex-col items-center justify-center flex-1">
        <DinoGame
          profile={profile}
          onOpenProgress={() => setShowProgress(true)}
          onOpenSettings={() => setShowSettings(true)}
          preloadedStream={cameraStream}
        />
      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-4xl mt-5 pt-3 border-t border-hitfit-border/60 text-center text-xs text-hitfit-muted flex flex-wrap items-center justify-between gap-2">
        <span>Privacy First: Camera processed 100% locally</span>
        <span>
          <a href="https://hitfit.zainaxes.com" target="_blank" rel="noopener noreferrer" className="hover:text-hitfit-accent transition-colors">
            hitfit.zainaxes.com
          </a>
        </span>
      </footer>

      {/* ONBOARDING MODAL (FIRST TIME VISIT) */}
      {showOnboarding && (
        <OnboardingModal
          initialProfile={profile}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* TODAY'S PROGRESS MODAL */}
      {showProgress && (
        <ProgressModal
          profile={profile}
          onClose={() => setShowProgress(false)}
        />
      )}

      {/* SETTINGS / PROFILE MODAL */}
      {showSettings && (
        <SettingsModal
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* OFFLINE STATUS BANNER */}
      <OfflineIndicator />
    </div>
  );
};

export default App;