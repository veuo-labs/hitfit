/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TYPES & INTERFACES ---

export type Gender = 'male' | 'female' | 'prefer_not_to_say';
export type AgeGroup = 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_64' | '65_plus';
export type FitnessGoal = 'get_fit' | 'lose_weight';
export type WeightUnit = 'kg' | 'lbs';

export interface UserProfile {
    onboarded: boolean;
    gender: Gender;
    ageGroup: AgeGroup;
    fitnessGoal: FitnessGoal;
    weightKg: number;
    weightDisplayUnit: WeightUnit;
    isGenericWeight: boolean;
    dailyCalorieGoal: number;
    reminderEnabled: boolean;
    reminderTime: string; // HH:MM in 24hr format
}

export interface ExerciseStats {
    jumps: number;
    sitStands: number;
    activeSeconds: number;
}

export interface CalorieBreakdown {
    jumpCalories: number;
    sitStandCalories: number;
    activeTimeCalories: number;
    totalCalories: number;
    isGenericEstimate: boolean;
    weightUsedKg: number;
}

export interface DailyActivity {
    date: string; // YYYY-MM-DD
    totalCalories: number;
    totalJumps: number;
    totalSitStands: number;
    totalActiveSeconds: number;
    sessionsCount: number;
}

// --- CONSTANTS & SCIENTIFIC MET PARAMETERS ---

/**
 * Standard MET (Metabolic Equivalent of Task) values:
 * 1 MET = 3.5 ml O2 / kg / min = approx 1 kcal / kg / hour at rest.
 * 
 * Formula:
 * kcal = MET * 3.5 * body_weight_kg / 200 * duration_minutes
 * 
 * MET_JUMP = 9.0 (Calisthenics, vigorous jumping / hopping)
 * Assuming an estimated 1.5s active muscular contraction per vertical leap.
 * 
 * MET_SIT_STAND = 5.5 (Moderate-to-vigorous chair stands / bodyweight squats)
 * Assuming an estimated 2.5s duration per complete descent and ascent cycle.
 * 
 * MET_ACTIVE_PACING = 4.0 (In-place dynamic athletic stance & reaction pacing)
 */
export const MET_CONFIG = {
    MET_JUMP: 9.0,
    JUMP_DURATION_SEC: 1.5,
    MET_SIT_STAND: 5.5,
    SIT_STAND_DURATION_SEC: 2.5,
    MET_ACTIVE_PACING: 4.0,
    GENERIC_WEIGHT_KG: 70, // 154.3 lbs standard reference weight
};

const STORAGE_KEYS = {
    PROFILE: 'hitfit_user_profile',
    LEGACY_PROFILE: 'leap_dino_user_profile',
    HISTORY: 'hitfit_daily_history',
    LEGACY_HISTORY: 'leap_dino_daily_history',
};

// --- DEFAULT STATE ---

export const DEFAULT_PROFILE: UserProfile = {
    onboarded: false,
    gender: 'prefer_not_to_say',
    ageGroup: '25_34',
    fitnessGoal: 'get_fit',
    weightKg: MET_CONFIG.GENERIC_WEIGHT_KG,
    weightDisplayUnit: 'kg',
    isGenericWeight: true,
    dailyCalorieGoal: 100, // conservative starter daily target
    reminderEnabled: true,
    reminderTime: '07:00',
};

// --- PROFILE STORAGE ---

export function getUserProfile(): UserProfile {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.PROFILE) || localStorage.getItem(STORAGE_KEYS.LEGACY_PROFILE);
        if (stored) {
            return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load profile from localStorage:', e);
    }
    return DEFAULT_PROFILE;
}

export function saveUserProfile(profile: UserProfile): void {
    try {
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
        console.warn('Failed to save profile to localStorage:', e);
    }
}

// --- CALORIE CALCULATION ENGINE ---

/**
 * Computes estimated calories burned using conservative MET calculations.
 * Always clearly tagged as an estimate.
 */
export function calculateCalories(
    stats: ExerciseStats,
    weightKg: number = MET_CONFIG.GENERIC_WEIGHT_KG,
    isGeneric: boolean = false
): CalorieBreakdown {
    const validWeight = Math.max(30, Math.min(250, weightKg || MET_CONFIG.GENERIC_WEIGHT_KG));

    // Jump calories
    const jumpDurationMin = (stats.jumps * MET_CONFIG.JUMP_DURATION_SEC) / 60;
    const jumpCalories = (MET_CONFIG.MET_JUMP * 3.5 * validWeight / 200) * jumpDurationMin;

    // Sit-to-stand calories
    const sitStandDurationMin = (stats.sitStands * MET_CONFIG.SIT_STAND_DURATION_SEC) / 60;
    const sitStandCalories = (MET_CONFIG.MET_SIT_STAND * 3.5 * validWeight / 200) * sitStandDurationMin;

    // Active pacing time (background gameplay active exertion)
    const activeTimeMin = (stats.activeSeconds || 0) / 60;
    const activeTimeCalories = (MET_CONFIG.MET_ACTIVE_PACING * 3.5 * validWeight / 200) * activeTimeMin;

    const totalCalories = jumpCalories + sitStandCalories + activeTimeCalories;

    return {
        jumpCalories: Math.round(jumpCalories * 10) / 10,
        sitStandCalories: Math.round(sitStandCalories * 10) / 10,
        activeTimeCalories: Math.round(activeTimeCalories * 10) / 10,
        totalCalories: Math.round(totalCalories * 10) / 10,
        isGenericEstimate: isGeneric,
        weightUsedKg: validWeight,
    };
}

// --- ACTIVITY HISTORY & STREAK ---

function getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getAllHistory(): Record<string, DailyActivity> {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.HISTORY) || localStorage.getItem(STORAGE_KEYS.LEGACY_HISTORY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load history:', e);
    }
    return {};
}

export function saveAllHistory(history: Record<string, DailyActivity>): void {
    try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save history:', e);
    }
}

export function getTodayActivity(): DailyActivity {
    const today = getTodayString();
    const history = getAllHistory();
    return history[today] || {
        date: today,
        totalCalories: 0,
        totalJumps: 0,
        totalSitStands: 0,
        totalActiveSeconds: 0,
        sessionsCount: 0,
    };
}

export function recordSession(sessionStats: ExerciseStats, profile: UserProfile): DailyActivity {
    const today = getTodayString();
    const history = getAllHistory();
    const todayActivity = history[today] || {
        date: today,
        totalCalories: 0,
        totalJumps: 0,
        totalSitStands: 0,
        totalActiveSeconds: 0,
        sessionsCount: 0,
    };

    const calories = calculateCalories(
        sessionStats,
        profile.weightKg,
        profile.isGenericWeight
    );

    todayActivity.totalCalories = Math.round((todayActivity.totalCalories + calories.totalCalories) * 10) / 10;
    todayActivity.totalJumps += sessionStats.jumps;
    todayActivity.totalSitStands += sessionStats.sitStands;
    todayActivity.totalActiveSeconds += Math.round(sessionStats.activeSeconds);
    todayActivity.sessionsCount += 1;

    history[today] = todayActivity;
    saveAllHistory(history);

    return todayActivity;
}

export function getWeeklyHistory(): DailyActivity[] {
    const history = getAllHistory();
    const result: DailyActivity[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        result.push(history[dateStr] || {
            date: dateStr,
            totalCalories: 0,
            totalJumps: 0,
            totalSitStands: 0,
            totalActiveSeconds: 0,
            sessionsCount: 0,
        });
    }

    return result;
}

export function calculateStreak(): number {
    const history = getAllHistory();
    let streak = 0;
    const now = new Date();

    // Check today first
    const todayStr = getTodayString();
    let checkDate = new Date(now);

    // If no activity today, check if yesterday had activity to continue streak
    if (!history[todayStr] || (history[todayStr].totalCalories === 0 && history[todayStr].totalJumps === 0)) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const day = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const entry = history[dateStr];
        if (entry && (entry.totalCalories > 0 || entry.totalJumps > 0 || entry.totalSitStands > 0)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}
