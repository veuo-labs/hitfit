/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
    UserProfile,
    Gender,
    AgeGroup,
    FitnessGoal,
    WeightUnit,
    saveUserProfile,
    MET_CONFIG
} from '../services/fitnessEngine';
import { checkPushSupport, subscribeToPush, sendTestPush, PushStatus } from '../services/pushService';

interface SettingsModalProps {
    profile: UserProfile;
    onUpdateProfile: (updated: UserProfile) => void;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ profile, onUpdateProfile, onClose }) => {
    const [gender, setGender] = useState<Gender>(profile.gender);
    const [ageGroup, setAgeGroup] = useState<AgeGroup>(profile.ageGroup);
    const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(profile.fitnessGoal);
    const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightDisplayUnit || 'kg');
    const [weightValue, setWeightValue] = useState<string>(
        profile.isGenericWeight ? '' : String(
            profile.weightDisplayUnit === 'lbs'
                ? Math.round(profile.weightKg * 2.20462)
                : profile.weightKg
        )
    );
    const [isGeneric, setIsGeneric] = useState<boolean>(profile.isGenericWeight);
    const [dailyGoal, setDailyGoal] = useState<number>(profile.dailyCalorieGoal || 100);

    // Reminder state
    const [reminderEnabled, setReminderEnabled] = useState<boolean>(profile.reminderEnabled);
    const [reminderTime, setReminderTime] = useState<string>(profile.reminderTime || '07:00');
    const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
    const [pushMessage, setPushMessage] = useState<string>('');
    const [isTestingPush, setIsTestingPush] = useState<boolean>(false);

    useEffect(() => {
        checkPushSupport().then(setPushStatus);
    }, []);

    const handleSave = () => {
        let finalWeightKg = MET_CONFIG.GENERIC_WEIGHT_KG;
        let genericFlag = true;

        if (!isGeneric && weightValue.trim() !== '') {
            const num = parseFloat(weightValue);
            if (!isNaN(num) && num > 20 && num < 400) {
                if (weightUnit === 'lbs') {
                    finalWeightKg = Math.round((num * 0.45359237) * 10) / 10;
                } else {
                    finalWeightKg = Math.round(num * 10) / 10;
                }
                genericFlag = false;
            }
        }

        const updated: UserProfile = {
            ...profile,
            gender,
            ageGroup,
            fitnessGoal,
            weightKg: finalWeightKg,
            weightDisplayUnit: weightUnit,
            isGenericWeight: genericFlag,
            dailyCalorieGoal: dailyGoal,
            reminderEnabled,
            reminderTime,
        };

        saveUserProfile(updated);
        onUpdateProfile(updated);

        if (reminderEnabled) {
            subscribeToPush(reminderTime).then((res) => {
                if (res.error) {
                    console.warn('Push subscription notice:', res.error);
                }
            });
        }

        onClose();
    };

    const handleTestNotification = async () => {
        setIsTestingPush(true);
        setPushMessage('Sending test reminder...');
        const result = await sendTestPush();
        if (result.success) {
            setPushMessage('Notification delivered! Check your device notifications.');
        } else {
            setPushMessage(`Notice: ${result.error || 'Failed to deliver'}`);
        }
        setIsTestingPush(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto border border-hitfit-border bg-hitfit-surface p-6 md:p-7 text-hitfit-text rounded-2xl shadow-2xl space-y-5 text-left">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-hitfit-border pb-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Profile & Settings
                        </h2>
                        <p className="text-xs text-hitfit-muted mt-0.5">Customize your targets and reminders</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-sm border border-hitfit-border bg-hitfit-card hover:border-hitfit-accent text-hitfit-muted hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Weight Setting */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-2.5">
                    <div className="text-sm font-heading font-bold text-hitfit-text">Body Weight</div>
                    <p className="text-xs text-hitfit-muted">Used to scale MET-based calorie burn calculations accurately.</p>
                    
                    <div className="flex items-center gap-3 pt-1">
                        <input
                            type="number"
                            placeholder="70"
                            disabled={isGeneric}
                            value={weightValue}
                            onChange={(e) => {
                                setWeightValue(e.target.value);
                                setIsGeneric(false);
                            }}
                            className="w-32 px-3.5 py-2 text-sm rounded-lg border border-hitfit-border bg-hitfit-bg text-hitfit-text disabled:opacity-40 focus:outline-none focus:border-hitfit-accent"
                        />
                        <div className="flex border border-hitfit-border rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setWeightUnit('kg')}
                                className={`px-3 py-1.5 text-xs font-semibold ${weightUnit === 'kg' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-bg text-hitfit-muted'}`}
                            >
                                KG
                            </button>
                            <button
                                type="button"
                                onClick={() => setWeightUnit('lbs')}
                                className={`px-3 py-1.5 text-xs font-semibold ${weightUnit === 'lbs' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-bg text-hitfit-muted'}`}
                            >
                                LBS
                            </button>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-hitfit-muted">
                        <input
                            type="checkbox"
                            checked={isGeneric}
                            onChange={(e) => {
                                setIsGeneric(e.target.checked);
                                if (e.target.checked) setWeightValue('');
                            }}
                            className="w-4 h-4 accent-[#F7B83D]"
                        />
                        <span>Use generic estimate (70 kg reference weight)</span>
                    </label>
                </div>

                {/* Fitness Goal & Daily Target */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-3">
                    <div className="text-sm font-heading font-bold text-hitfit-text">Daily Goal & Objective</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <button
                            type="button"
                            onClick={() => setFitnessGoal('get_fit')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                fitnessGoal === 'get_fit'
                                    ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold shadow-md'
                                    : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                            }`}
                        >
                            Get Fit
                        </button>
                        <button
                            type="button"
                            onClick={() => setFitnessGoal('lose_weight')}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                fitnessGoal === 'lose_weight'
                                    ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold shadow-md'
                                    : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                            }`}
                        >
                            Lose Weight
                        </button>
                    </div>

                    <div className="pt-1">
                        <label className="block text-xs text-hitfit-muted mb-2">Daily Target (Est. kcal):</label>
                        <div className="flex gap-2 flex-wrap">
                            {[50, 100, 150, 200, 300].map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setDailyGoal(val)}
                                    className={`px-3.5 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                                        dailyGoal === val
                                            ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent'
                                            : 'bg-hitfit-bg text-hitfit-text border-hitfit-border hover:border-hitfit-accent/50'
                                    }`}
                                >
                                    {val} kcal
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Daily Exercise Reminders (Web Push & Scheduler) */}
                <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-3">
                    <div className="text-sm font-heading font-bold flex justify-between items-center text-hitfit-text">
                        <span>Daily Exercise Reminder</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-hitfit-muted">
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={(e) => setReminderEnabled(e.target.checked)}
                                className="w-4 h-4 accent-[#F7B83D]"
                            />
                            <span>{reminderEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                    </div>

                    <p className="text-xs text-hitfit-muted leading-relaxed">
                        Delivers a workout nudge to your device at your selected local time (Default: 7:00 AM).
                    </p>

                    {reminderEnabled && (
                        <div className="space-y-3 pt-1">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-hitfit-text">Reminder Time:</span>
                                <input
                                    type="time"
                                    value={reminderTime}
                                    onChange={(e) => setReminderTime(e.target.value)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-hitfit-border bg-hitfit-bg text-hitfit-text font-sans"
                                />
                                <span className="text-xs text-hitfit-muted">(Default: 07:00 AM)</span>
                            </div>

                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={handleTestNotification}
                                    disabled={isTestingPush}
                                    className="px-3.5 py-2 text-xs border border-hitfit-border bg-hitfit-bg hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                                >
                                    {isTestingPush ? 'Testing...' : 'Send Test Notification'}
                                </button>
                            </div>

                            {pushMessage && (
                                <div className="text-xs text-hitfit-accent border border-hitfit-accent/30 p-2.5 rounded-lg bg-hitfit-accent/10">
                                    {pushMessage}
                                </div>
                            )}

                            {pushStatus?.error && (
                                <div className="text-[11px] text-hitfit-muted">
                                    Note: {pushStatus.error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="pt-2">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-heading font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
