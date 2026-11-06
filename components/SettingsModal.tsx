/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
    soundEnabled?: boolean;
    onToggleSound?: (enabled: boolean) => void;
    sensitivity?: 'standard' | 'high' | 'low';
    onChangeSensitivity?: (s: 'standard' | 'high' | 'low') => void;
    videoStream?: MediaStream | null;
    onCalibrate?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    profile,
    onUpdateProfile,
    onClose,
    soundEnabled = true,
    onToggleSound,
    sensitivity = 'standard',
    onChangeSensitivity,
    videoStream,
    onCalibrate
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'camera' | 'reminders'>('profile');

    // Profile state
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

    // Audio & Motion state
    const [sound, setSound] = useState<boolean>(soundEnabled);
    const [motionSens, setMotionSens] = useState<'standard' | 'high' | 'low'>(sensitivity);

    // Reminder state
    const [reminderEnabled, setReminderEnabled] = useState<boolean>(profile.reminderEnabled);
    const [reminderTime, setReminderTime] = useState<string>(profile.reminderTime || '07:00');
    const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
    const [pushMessage, setPushMessage] = useState<string>('');
    const [isTestingPush, setIsTestingPush] = useState<boolean>(false);
    const [calibrationMsg, setCalibrationMsg] = useState<string>('');

    // Preview video element
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        checkPushSupport().then(setPushStatus);
    }, []);

    useEffect(() => {
        if (activeTab === 'camera' && videoStream && previewVideoRef.current) {
            previewVideoRef.current.srcObject = videoStream;
        }
    }, [activeTab, videoStream]);

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

        if (onToggleSound) onToggleSound(sound);
        if (onChangeSensitivity) onChangeSensitivity(motionSens);

        if (reminderEnabled) {
            subscribeToPush(reminderTime).then((res) => {
                if (res.error) {
                    console.warn('Push subscription notice:', res.error);
                }
            });
        }

        onClose();
    };

    const handleCalibrateClick = () => {
        if (onCalibrate) {
            onCalibrate();
            setCalibrationMsg('Calibrated to current standing posture.');
            setTimeout(() => setCalibrationMsg(''), 3000);
        }
    };

    const handleTestNotification = async () => {
        setIsTestingPush(true);
        setPushMessage('Sending test reminder...');
        const result = await sendTestPush();
        if (result.success) {
            setPushMessage('Notification delivered. Check your device notifications.');
        } else {
            setPushMessage(`Notice: ${result.error || 'Failed to deliver'}`);
        }
        setIsTestingPush(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto border border-hitfit-border bg-hitfit-surface p-5 md:p-7 text-hitfit-text rounded-2xl shadow-2xl space-y-5 text-left">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-hitfit-border pb-3">
                    <div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Settings
                        </h2>
                        <p className="text-xs text-hitfit-muted mt-0.5">Customize workout targets, camera & audio</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-sm border border-hitfit-border bg-hitfit-card hover:border-hitfit-accent text-hitfit-muted hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-hitfit-border gap-2 text-xs">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
                            activeTab === 'profile'
                                ? 'border-hitfit-accent text-hitfit-accent'
                                : 'border-transparent text-hitfit-muted hover:text-hitfit-text'
                        }`}
                    >
                        Profile & Targets
                    </button>
                    <button
                        onClick={() => setActiveTab('camera')}
                        className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
                            activeTab === 'camera'
                                ? 'border-hitfit-accent text-hitfit-accent'
                                : 'border-transparent text-hitfit-muted hover:text-hitfit-text'
                        }`}
                    >
                        Camera & Sound
                    </button>
                    <button
                        onClick={() => setActiveTab('reminders')}
                        className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
                            activeTab === 'reminders'
                                ? 'border-hitfit-accent text-hitfit-accent'
                                : 'border-transparent text-hitfit-muted hover:text-hitfit-text'
                        }`}
                    >
                        Daily Reminder
                    </button>
                </div>

                {/* TAB 1: PROFILE & TARGETS */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        {/* Body Weight */}
                        <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-2">
                            <div className="text-sm font-heading font-bold text-hitfit-text">Body Weight</div>
                            <p className="text-xs text-hitfit-muted">Calibrates MET calorie expenditure accurately to your mass.</p>
                            
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
                                    className="w-28 px-3 py-1.5 text-xs rounded-lg border border-hitfit-border bg-hitfit-bg text-hitfit-text disabled:opacity-40 focus:outline-none focus:border-hitfit-accent font-sans"
                                />
                                <div className="flex border border-hitfit-border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setWeightUnit('kg')}
                                        className={`px-3 py-1 text-xs font-semibold ${weightUnit === 'kg' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-bg text-hitfit-muted'}`}
                                    >
                                        KG
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWeightUnit('lbs')}
                                        className={`px-3 py-1 text-xs font-semibold ${weightUnit === 'lbs' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-bg text-hitfit-muted'}`}
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
                                    className="w-3.5 h-3.5 accent-[#F7B83D]"
                                />
                                <span>Use generic standard (70 kg reference)</span>
                            </label>
                        </div>

                        {/* Goal & Daily Target */}
                        <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-3">
                            <div className="text-sm font-heading font-bold text-hitfit-text">Fitness Objective & Target</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFitnessGoal('get_fit')}
                                    className={`py-2 px-3 rounded-lg border text-center transition-all ${
                                        fitnessGoal === 'get_fit'
                                            ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold'
                                            : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                                    }`}
                                >
                                    Get Fit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFitnessGoal('lose_weight')}
                                    className={`py-2 px-3 rounded-lg border text-center transition-all ${
                                        fitnessGoal === 'lose_weight'
                                            ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold'
                                            : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                                    }`}
                                >
                                    Lose Weight
                                </button>
                            </div>

                            <div className="pt-1">
                                <span className="block text-xs text-hitfit-muted mb-2">Daily Goal (Estimated kcal):</span>
                                <div className="flex gap-2 flex-wrap">
                                    {[50, 100, 150, 200, 300].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setDailyGoal(val)}
                                            className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all ${
                                                dailyGoal === val
                                                    ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent'
                                                    : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                                            }`}
                                        >
                                            {val} kcal
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: CAMERA & SOUND (MOVED OUT OF MAIN GAME VIEW) */}
                {activeTab === 'camera' && (
                    <div className="space-y-4">
                        {/* Audio Settings */}
                        <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-sm font-heading font-bold text-hitfit-text">Sound Effects</div>
                                <p className="text-xs text-hitfit-muted mt-0.5">Footsteps, jump cues, and rep completion chimes</p>
                            </div>
                            <label className="cursor-pointer flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={sound}
                                    onChange={(e) => setSound(e.target.checked)}
                                    className="w-4 h-4 accent-[#F7B83D]"
                                />
                                <span className="text-xs font-semibold text-hitfit-text">{sound ? 'Enabled' : 'Muted'}</span>
                            </label>
                        </div>

                        {/* Motion Sensitivity */}
                        <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-2">
                            <div className="text-sm font-heading font-bold text-hitfit-text">Motion Detection Sensitivity</div>
                            <p className="text-xs text-hitfit-muted">Adjust if your jumps or squats trigger too easily or require more exertion.</p>
                            
                            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                                {(['standard', 'high', 'low'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setMotionSens(s)}
                                        className={`py-2 px-3 rounded-lg border capitalize transition-all ${
                                            motionSens === s
                                                ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold'
                                                : 'bg-hitfit-bg text-hitfit-text border-hitfit-border'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Live Camera Feed Preview & Calibration */}
                        <div className="border border-hitfit-border bg-hitfit-card p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-heading font-bold text-hitfit-text">Live Motion Tracker</div>
                                    <p className="text-xs text-hitfit-muted">Position your device so your upper body is clearly in view.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCalibrateClick}
                                    className="px-3 py-1.5 text-xs bg-hitfit-bg border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                                >
                                    Calibrate Posture
                                </button>
                            </div>

                            {calibrationMsg && (
                                <p className="text-xs text-hitfit-accent font-semibold">{calibrationMsg}</p>
                            )}

                            {/* Camera Preview */}
                            <div className="relative w-full aspect-[4/3] max-w-[280px] mx-auto rounded-lg overflow-hidden border border-hitfit-border bg-black flex items-center justify-center">
                                {videoStream ? (
                                    <video
                                        ref={previewVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover scale-x-[-1]"
                                    />
                                ) : (
                                    <span className="text-xs text-hitfit-muted px-4 text-center">
                                        Camera is active during gameplay. Start the workout to stream preview.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: DAILY REMINDERS */}
                {activeTab === 'reminders' && (
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
                            Sends an automated workout reminder to your device at your selected time.
                        </p>

                        {reminderEnabled && (
                            <div className="space-y-3 pt-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-hitfit-text">Time:</span>
                                    <input
                                        type="time"
                                        value={reminderTime}
                                        onChange={(e) => setReminderTime(e.target.value)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-hitfit-border bg-hitfit-bg text-hitfit-text font-sans"
                                    />
                                </div>

                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={handleTestNotification}
                                        disabled={isTestingPush}
                                        className="px-3.5 py-1.5 text-xs border border-hitfit-border bg-hitfit-bg hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent rounded-lg transition-colors cursor-pointer"
                                    >
                                        {isTestingPush ? 'Testing...' : 'Send Test Notification'}
                                    </button>
                                </div>

                                {pushMessage && (
                                    <div className="text-xs text-hitfit-accent border border-hitfit-accent/30 p-2 rounded-lg bg-hitfit-accent/10">
                                        {pushMessage}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Save Button */}
                <div className="pt-2">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-heading font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg"
                    >
                        Save & Apply
                    </button>
                </div>
            </div>
        </div>
    );
};
