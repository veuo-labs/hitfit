/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AboutModalProps {
    onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-lg border border-hitfit-border bg-hitfit-surface p-6 md:p-8 text-hitfit-text rounded-2xl shadow-2xl space-y-6 text-left max-h-[92vh] overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-start justify-between border-b border-hitfit-border pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-hitfit-accent inline-block"></span>
                            <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text tracking-tight">
                                About HitFit
                            </h2>
                        </div>
                        <p className="text-xs text-hitfit-muted mt-1 italic">
                            Hit the target to be fit.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-sm border border-hitfit-border bg-hitfit-card hover:border-hitfit-accent text-hitfit-muted hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Developer Credit Section */}
                <div className="border border-hitfit-border bg-hitfit-card p-5 rounded-xl space-y-3">
                    <div className="text-xs tracking-wider text-hitfit-accent uppercase font-bold">
                        Creator & Developer
                    </div>
                    <div>
                        <h3 className="text-lg font-heading font-bold text-hitfit-text">
                            Zain Ul Abidin
                        </h3>
                        <p className="text-xs text-hitfit-muted mt-0.5">
                            Solo Freelancer · Brand: <strong className="text-hitfit-text font-normal">zainaxes</strong>
                        </p>
                    </div>

                    <div className="pt-2">
                        <a
                            href="https://zainaxes.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs font-semibold text-hitfit-accent hover:underline"
                        >
                            Visit Portfolio: zainaxes.com →
                        </a>
                    </div>
                </div>

                {/* Developer Ecosystem */}
                <div className="border border-hitfit-border bg-hitfit-card p-5 rounded-xl space-y-3">
                    <div className="text-xs tracking-wider text-hitfit-muted uppercase font-bold">
                        Other Products by Developer
                    </div>
                    <ul className="space-y-2 text-xs">
                        <li>
                            <a
                                href="https://axeskit.zainaxes.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hitfit-text hover:text-hitfit-accent transition-colors block"
                            >
                                axeskit.zainaxes.com <span className="text-hitfit-muted">· Tools and UI utilities</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://axeslab.zainaxes.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hitfit-text hover:text-hitfit-accent transition-colors block"
                            >
                                axeslab.zainaxes.com <span className="text-hitfit-muted">· Research and experiments</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://axescontrol.zainaxes.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hitfit-text hover:text-hitfit-accent transition-colors block"
                            >
                                axescontrol.zainaxes.com <span className="text-hitfit-muted">· Controls and system modules</span>
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Technical Overview */}
                <div className="border border-hitfit-border bg-hitfit-card p-5 rounded-xl space-y-2.5 text-xs text-hitfit-muted leading-relaxed">
                    <div className="text-xs tracking-wider text-hitfit-muted uppercase font-bold text-hitfit-text">
                        Game Architecture
                    </div>
                    <p>
                        HitFit turns body movement into gameplay. Jump physically to leap over hurdles; squat down to duck beneath flying obstacles.
                    </p>
                    <p>
                        Privacy First: All camera frames are processed 100% locally on your device using real-time computer vision. No video is ever recorded or uploaded.
                    </p>
                    <p>
                        Calorie estimation uses peer-reviewed MET (Metabolic Equivalent of Task) sports science tailored to your selected body profile.
                    </p>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-heading font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg"
                >
                    Return to Game
                </button>
            </div>
        </div>
    );
};
