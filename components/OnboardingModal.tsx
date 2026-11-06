/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
    UserProfile,
    Gender,
    AgeGroup,
    FitnessGoal,
    WeightUnit,
    saveUserProfile,
    MET_CONFIG
} from '../services/fitnessEngine';

interface OnboardingModalProps {
    initialProfile: UserProfile;
    onComplete: (profile: UserProfile, cameraStream?: MediaStream | null) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ initialProfile, onComplete }) => {
    const [step, setStep] = useState<number>(1);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraDenied, setCameraDenied] = useState<boolean>(false);
    const [cameraRequesting, setCameraRequesting] = useState<boolean>(false);

    // Profile working state
    const [gender, setGender] = useState<Gender>(initialProfile.gender || 'prefer_not_to_say');
    const [ageGroup, setAgeGroup] = useState<AgeGroup>(initialProfile.ageGroup || '25_34');
    const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(initialProfile.fitnessGoal || 'get_fit');
    const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
    const [weightInput, setWeightInput] = useState<string>('');
    const [isGeneric, setIsGeneric] = useState<boolean>(true);

    // Step 1: Camera Permission Request
    const handleRequestCamera = async () => {
        setCameraRequesting(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                }
            });
            setCameraStream(stream);
            setCameraDenied(false);
            setStep(2);
        } catch (err) {
            console.warn('Camera permission denied or unavailable:', err);
            setCameraDenied(true);
        } finally {
            setCameraRequesting(false);
        }
    };

    const handleContinueWithoutCamera = () => {
        setCameraStream(null);
        setCameraDenied(true);
        setStep(2);
    };

    // Step 5 Submit & Finalize
    const handleFinish = (skippedWeight: boolean) => {
        let finalWeightKg = MET_CONFIG.GENERIC_WEIGHT_KG;
        let genericFlag = true;

        if (!skippedWeight && weightInput.trim() !== '') {
            const num = parseFloat(weightInput);
            if (!isNaN(num) && num > 20 && num < 400) {
                if (weightUnit === 'lbs') {
                    finalWeightKg = Math.round((num * 0.45359237) * 10) / 10;
                } else {
                    finalWeightKg = Math.round(num * 10) / 10;
                }
                genericFlag = false;
            }
        }

        const updatedProfile: UserProfile = {
            ...initialProfile,
            onboarded: true,
            gender,
            ageGroup,
            fitnessGoal,
            weightKg: finalWeightKg,
            weightDisplayUnit: weightUnit,
            isGenericWeight: genericFlag,
            dailyCalorieGoal: fitnessGoal === 'lose_weight' ? 200 : 100,
        };

        saveUserProfile(updatedProfile);
        onComplete(updatedProfile, cameraStream);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-serif">
            <div className="w-full max-w-lg border border-hitfit-border bg-hitfit-surface p-7 text-center text-hitfit-text rounded-2xl shadow-2xl relative">
                
                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-1.5 mb-5">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all ${
                                s === step
                                    ? 'w-7 bg-hitfit-accent'
                                    : s < step
                                    ? 'w-3 bg-hitfit-accent/50'
                                    : 'w-3 bg-hitfit-border'
                            }`}
                        />
                    ))}
                </div>

                {/* STEP 1: CAMERA PERMISSION */}
                {step === 1 && (
                    <div className="space-y-5">
                        <div className="inline-block px-3 py-1 bg-hitfit-accent/10 border border-hitfit-accent/30 rounded-full text-xs text-hitfit-accent font-medium">
                            Step 1: Motion Setup
                        </div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Your camera controls the game.
                        </h2>
                        <p className="text-sm leading-relaxed text-hitfit-muted">
                            Your movements stay strictly on your device. Video is processed locally in real-time and is never recorded or uploaded.
                        </p>

                        {cameraDenied && (
                            <div className="border border-hitfit-danger/40 bg-hitfit-danger/10 p-3.5 rounded-xl text-xs text-hitfit-text leading-relaxed text-left">
                                Camera access was not granted or is unavailable on this device.
                                <br /><br />
                                You can still play seamlessly using <strong>Spacebar</strong> (Jump) and <strong>Down Arrow</strong> (Squat), or touch taps.
                            </div>
                        )}

                        <div className="pt-2 flex flex-col gap-3">
                            <button
                                onClick={handleRequestCamera}
                                disabled={cameraRequesting}
                                className="w-full py-3.5 bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-heading font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                            >
                                {cameraRequesting ? 'Requesting Access...' : 'Enable Camera & Start'}
                            </button>

                            {cameraDenied && (
                                <button
                                    onClick={handleContinueWithoutCamera}
                                    className="w-full py-2.5 bg-transparent text-hitfit-muted text-xs hover:text-hitfit-text transition-colors cursor-pointer"
                                >
                                    Continue With Keyboard & Touch Controls →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 2: GENDER */}
                {step === 2 && (
                    <div className="space-y-5">
                        <div className="inline-block px-3 py-1 bg-hitfit-accent/10 border border-hitfit-accent/30 rounded-full text-xs text-hitfit-accent font-medium">
                            Step 2: Profile
                        </div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Select your gender
                        </h2>
                        <p className="text-xs text-hitfit-muted leading-relaxed">
                            Used to customize your profile summary. Never used to exaggerate calorie estimates.
                        </p>

                        <div className="flex flex-col gap-3 pt-2">
                            {(
                                [
                                    { id: 'male', label: 'Male' },
                                    { id: 'female', label: 'Female' },
                                    { id: 'prefer_not_to_say', label: 'Prefer not to say' },
                                ] as { id: Gender; label: string }[]
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setGender(item.id);
                                        setStep(3);
                                    }}
                                    className={`py-3.5 px-4 text-sm text-left rounded-xl border transition-all cursor-pointer ${
                                        gender === item.id
                                            ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold shadow-md'
                                            : 'bg-hitfit-card text-hitfit-text border-hitfit-border hover:border-hitfit-accent/50'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 3: AGE GROUP */}
                {step === 3 && (
                    <div className="space-y-5">
                        <div className="inline-block px-3 py-1 bg-hitfit-accent/10 border border-hitfit-accent/30 rounded-full text-xs text-hitfit-accent font-medium">
                            Step 3: Age Bracket
                        </div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Which age group are you in?
                        </h2>
                        <p className="text-xs text-hitfit-muted">
                            No full birth dates are requested or stored.
                        </p>

                        <div className="grid grid-cols-2 gap-2.5 pt-2">
                            {(
                                [
                                    { id: 'under_18', label: 'Under 18' },
                                    { id: '18_24', label: '18–24' },
                                    { id: '25_34', label: '25–34' },
                                    { id: '35_44', label: '35–44' },
                                    { id: '45_54', label: '45–54' },
                                    { id: '55_64', label: '55–64' },
                                    { id: '65_plus', label: '65+' },
                                ] as { id: AgeGroup; label: string }[]
                            ).map((group) => (
                                <button
                                    key={group.id}
                                    onClick={() => {
                                        setAgeGroup(group.id);
                                        setStep(4);
                                    }}
                                    className={`py-3 px-3 text-xs text-center rounded-xl border transition-all cursor-pointer ${
                                        ageGroup === group.id
                                            ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent font-semibold shadow-md'
                                            : 'bg-hitfit-card text-hitfit-text border-hitfit-border hover:border-hitfit-accent/50'
                                    }`}
                                >
                                    {group.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 4: FITNESS GOAL */}
                {step === 4 && (
                    <div className="space-y-5">
                        <div className="inline-block px-3 py-1 bg-hitfit-accent/10 border border-hitfit-accent/30 rounded-full text-xs text-hitfit-accent font-medium">
                            Step 4: Objective
                        </div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            What's your fitness goal?
                        </h2>
                        <p className="text-xs text-hitfit-muted leading-relaxed">
                            Personalizes target suggestions and reminders. Calorie formulas remain scientifically consistent.
                        </p>

                        <div className="flex flex-col gap-3.5 pt-2">
                            <button
                                onClick={() => {
                                    setFitnessGoal('get_fit');
                                    setStep(5);
                                }}
                                className={`py-4 px-5 text-left rounded-xl border transition-all cursor-pointer ${
                                    fitnessGoal === 'get_fit'
                                        ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent shadow-md'
                                        : 'bg-hitfit-card text-hitfit-text border-hitfit-border hover:border-hitfit-accent/50'
                                }`}
                            >
                                <div className="font-heading font-bold text-base mb-1">Get Fit</div>
                                <div className="text-xs opacity-90">Daily movement, stamina & core leg strength</div>
                            </button>

                            <button
                                onClick={() => {
                                    setFitnessGoal('lose_weight');
                                    setStep(5);
                                }}
                                className={`py-4 px-5 text-left rounded-xl border transition-all cursor-pointer ${
                                    fitnessGoal === 'lose_weight'
                                        ? 'bg-hitfit-accent text-hitfit-bg border-hitfit-accent shadow-md'
                                        : 'bg-hitfit-card text-hitfit-text border-hitfit-border hover:border-hitfit-accent/50'
                                }`}
                            >
                                <div className="font-heading font-bold text-base mb-1">Lose Weight</div>
                                <div className="text-xs opacity-90">Calorie burning & higher repetition targets</div>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: BODY WEIGHT (OPTIONAL) */}
                {step === 5 && (
                    <div className="space-y-5">
                        <div className="inline-block px-3 py-1 bg-hitfit-accent/10 border border-hitfit-accent/30 rounded-full text-xs text-hitfit-accent font-medium">
                            Step 5: Calorie Accuracy
                        </div>
                        <h2 className="text-xl md:text-2xl font-heading font-bold text-hitfit-text">
                            Body Weight (Optional)
                        </h2>
                        <p className="text-xs text-hitfit-muted leading-relaxed">
                            Body weight materially improves the accuracy of MET calorie estimates. You can skip to use a generic 70 kg reference.
                        </p>

                        <div className="flex items-center justify-center gap-2 pt-2">
                            <input
                                type="number"
                                placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
                                value={weightInput}
                                onChange={(e) => {
                                    setWeightInput(e.target.value);
                                    setIsGeneric(false);
                                }}
                                className="w-36 px-4 py-2.5 text-sm rounded-xl border border-hitfit-border bg-hitfit-card text-hitfit-text text-center focus:outline-none focus:border-hitfit-accent"
                            />

                            <div className="flex border border-hitfit-border rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setWeightUnit('kg')}
                                    className={`px-3.5 py-2 text-xs font-semibold ${
                                        weightUnit === 'kg' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-card text-hitfit-muted'
                                    }`}
                                >
                                    KG
                                </button>
                                <button
                                    onClick={() => setWeightUnit('lbs')}
                                    className={`px-3.5 py-2 text-xs font-semibold ${
                                        weightUnit === 'lbs' ? 'bg-hitfit-accent text-hitfit-bg' : 'bg-hitfit-card text-hitfit-muted'
                                    }`}
                                >
                                    LBS
                                </button>
                            </div>
                        </div>

                        <div className="pt-3 flex flex-col gap-2.5">
                            <button
                                onClick={() => handleFinish(false)}
                                disabled={!weightInput.trim()}
                                className="w-full py-3.5 bg-hitfit-accent hover:bg-hitfit-accentHover text-hitfit-bg font-heading font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-40"
                            >
                                Save & Start Playing
                            </button>

                            <button
                                onClick={() => handleFinish(true)}
                                className="w-full py-2 text-hitfit-muted hover:text-hitfit-text text-xs underline transition-colors cursor-pointer"
                            >
                                Skip (Use generic 70 kg reference)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
