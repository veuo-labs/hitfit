/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="px-3 py-1.5 text-xs font-serif bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
        title="Install HitFit PWA"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="px-3 py-1.5 text-xs font-serif bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer shadow-sm"
        >
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-sm border border-hitfit-border bg-hitfit-surface p-6 text-left text-hitfit-text rounded-2xl shadow-2xl">
              <h3 className="text-base font-heading font-bold text-hitfit-text mb-2">Install on iPhone</h3>
              <p className="text-xs text-hitfit-muted leading-relaxed mb-4">
                1. Tap the <strong className="text-hitfit-accent">Share</strong> icon in the Safari toolbar.<br />
                2. Scroll down & select <strong className="text-hitfit-accent">Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-hitfit-accent text-hitfit-bg text-xs font-heading font-bold rounded-xl hover:bg-hitfit-accentHover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
