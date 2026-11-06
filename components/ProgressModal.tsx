/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
    getTodayActivity,
    getWeeklyHistory,
    calculateStreak,
    UserProfile
} from '../services/fitnessEngine';

interface ProgressModalProps {
    profile: UserProfile;
    onClose: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ profile, onClose }) => {
    const today = getTodayActivity();
    const history = getWeeklyHistory();
    const streak = calculateStreak();

    const goal = profile.dailyCalorieGoal || 100;
    const progressPercent = Math.min(100, Math.round((today.totalCalories / goal) * 100));

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto border border-hitfit-border bg-hitfit-surface p-6 md:p-7 text-hitfit-text rounded-2xl shadow-2xl space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-hitfit-border pb-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Today's Progress
                        </h2>
                        <span className="text-xs text-hitfit-muted">{today.date}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-sm border border-hitfit-border bg-hitfit-card hover:border-hitfit-accent text-hitfit-muted hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Streak Badge */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl flex items-center justify-between text-sm">
                    <span className="text-hitfit-muted">Daily Exercise Streak:</span>
                    <span className="font-heading font-bold text-hitfit-accent">
                        {streak} {streak === 1 ? 'Day' : 'Days'} In a Row
                    </span>
                </div>

                {/* Daily Goal Bar */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-2.5 text-left">
                    <div className="flex justify-between text-xs">
                        <span className="text-hitfit-muted">Daily Goal:</span>
                        <span className="font-semibold text-hitfit-text">{today.totalCalories} / {goal} kcal</span>
                    </div>
                    <div className="w-full bg-hitfit-bg rounded-full h-3 overflow-hidden border border-hitfit-border">
                        <div
                            className="bg-hitfit-accent h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] text-hitfit-muted">
                        <span>{progressPercent}% completed</span>
                        <span>
                            {progressPercent >= 100
                                ? 'Target reached!'
                                : `${Math.max(0, goal - Math.floor(today.totalCalories))} kcal to goal`}
                        </span>
                    </div>
                </div>

                {/* Today's Counters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="border border-hitfit-border bg-hitfit-card p-3.5 rounded-xl">
                        <div className="text-[11px] text-hitfit-muted mb-1">Calories</div>
                        <div className="text-lg font-heading font-bold text-hitfit-accent">{today.totalCalories}</div>
                        <div className="text-[10px] text-hitfit-muted">Est. kcal</div>
                    </div>
                    <div className="border border-hitfit-border bg-hitfit-card p-3.5 rounded-xl">
                        <div className="text-[11px] text-hitfit-muted mb-1">Jumps</div>
                        <div className="text-lg font-heading font-bold text-hitfit-text">{today.totalJumps}</div>
                        <div className="text-[10px] text-hitfit-muted">Repetitions</div>
                    </div>
                    <div className="border border-hitfit-border bg-hitfit-card p-3.5 rounded-xl">
                        <div className="text-[11px] text-hitfit-muted mb-1">Squats</div>
                        <div className="text-lg font-heading font-bold text-hitfit-text">{today.totalSitStands}</div>
                        <div className="text-[10px] text-hitfit-muted">Repetitions</div>
                    </div>
                    <div className="border border-hitfit-border bg-hitfit-card p-3.5 rounded-xl">
                        <div className="text-[11px] text-hitfit-muted mb-1">Active Time</div>
                        <div className="text-sm font-heading font-bold text-hitfit-text pt-1">{formatDuration(today.totalActiveSeconds)}</div>
                        <div className="text-[10px] text-hitfit-muted">{today.sessionsCount} sessions</div>
                    </div>
                </div>

                {/* Weekly Activity History */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-3">
                    <div className="text-xs font-heading font-bold border-b border-hitfit-border pb-2 flex justify-between text-hitfit-text">
                        <span>Past 7 Days Activity</span>
                        <span className="text-[11px] text-hitfit-muted font-normal">Est. Calories / Reps</span>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                        {history.map((day) => {
                            const isToday = day.date === today.date;
                            return (
                                <div
                                    key={day.date}
                                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                        isToday ? 'bg-hitfit-border/40 font-semibold text-hitfit-accent' : 'text-hitfit-muted'
                                    }`}
                                >
                                    <span className="text-xs">{day.date.slice(5)} {isToday ? '(Today)' : ''}</span>
                                    <span className="text-xs text-hitfit-muted">
                                        {day.totalJumps} J · {day.totalSitStands} S
                                    </span>
                                    <span className="font-heading font-bold text-xs text-hitfit-text">
                                        {day.totalCalories} kcal
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Disclaimer */}
                <p className="text-[11px] leading-relaxed text-hitfit-muted text-left italic">
                    * Calorie metrics are calculated via standardized MET scientific formulas
                    (Jumping: 9.0 MET, Squats: 5.5 MET) scaled to {profile.isGenericWeight ? 'a generic 70 kg reference weight' : `${profile.weightKg} kg body weight`}.
                </p>

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
