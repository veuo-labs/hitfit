/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    UserProfile,
    getUserProfile,
    calculateCalories,
    recordSession,
    MET_CONFIG,
    ExerciseStats
} from '../services/fitnessEngine';

// --- TYPES & INTERFACES ---

interface ExtendedWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}

interface VisionState {
    poseLandmarker: any;
    lastVideoTime: number;
    results: any;
    prevY: number;
    prevTime: number;
    smoothedVelocity: number;
    peakVelocity: number;
    JUMP_VELOCITY_THRESHOLD: number;
    lastPredictionTime: number;
    standingBaselineY: number;
    isCalibrated: boolean;
    exercisePosture: 'STANDING' | 'SQUATTING';
    squatStartTime: number;
    jumpCooldown: number;
}

interface GameObject {
    active: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface GameEngineState {
    gameRunning: boolean;
    canRestart: boolean;
    scoreCalories: number;
    jumpsCount: number;
    sitStandsCount: number;
    activeSeconds: number;
    gameSpeed: number;
    lastTime: number;
    obstaclePool: CactusObstacle[];
    groundPool: GroundDetail[];
    spawnTimer: number;
    groundSpawnTimer: number;
    animationId: number;
    visionAnimationId: number;
    runner: RunnerEntity;
    hasStarted: boolean;
    cameraReady: boolean;
}

interface RunnerEntity {
    x: number;
    y: number;
    width: number;
    height: number;
    dy: number;
    grounded: boolean;
    jumpTimer: number;
    legState: boolean;
    animTimer: number;
    isDucking: boolean;
    jump: () => boolean;
    duck: (ducking: boolean) => void;
    update: (dt: number, onStep?: () => void) => void;
    draw: (ctx: CanvasRenderingContext2D) => void;
    reset: () => void;
}

// --- CONSTANTS ---

const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 300,
    GROUND_Y: 242,
    GRAVITY: 4000,
    JUMP_FORCE: 1000,
    INITIAL_SPEED: 400,
    MAX_SPEED: 1100,
    SPEED_INCREMENT: 8,
    RUNNER_START_X: 60,
    RUNNER_GROUND_Y: 199,
    RUNNER_DUCK_Y: 216,
    VISION_FPS: 30,
    // INSIDE THE GAME BOX: Classic Light Canvas with High-Contrast Dark Elements
    CANVAS: {
        BG: '#FFFFFF',
        PRIMARY: '#535353',
        TEXT: '#535353',
        GROUND: '#535353',
        EYE: '#FFFFFF',
    },
    // OUTSIDE THE GAME BOX: HitFit Dark Theme
    PAGE: {
        BG: '#15191C',
        SURFACE: '#1E2328',
        BORDER: '#2E363E',
        BORDER_LIGHT: '#434E58',
        TEXT: '#ECEFF2',
        MUTED: '#9AA6B2',
        ACCENT: '#F7B83D',
        ACCENT_HOVER: '#E5A52A',
        DANGER: '#FF5C5C',
    }
};

// --- AUDIO SYNTHESIS ---

const SoundSynth = {
    ctx: null as AudioContext | null,
    bufferCache: {} as Record<string, AudioBuffer>,

    init: () => {
        if (!SoundSynth.ctx) {
            const Win = window as ExtendedWindow;
            SoundSynth.ctx = new (window.AudioContext || Win.webkitAudioContext)();
        }
        if (SoundSynth.ctx.state === 'suspended') {
            SoundSynth.ctx.resume();
        }

        if (!SoundSynth.bufferCache['step']) {
            SoundSynth.bufferCache['step'] = SoundSynth.createNoiseBuffer(0.04);
        }
        if (!SoundSynth.bufferCache['roar']) {
            SoundSynth.bufferCache['roar'] = SoundSynth.createNoiseBuffer(0.8);
        }
    },

    createNoiseBuffer: (duration: number): AudioBuffer => {
        const ctx = SoundSynth.ctx!;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    playJump: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

        osc.start(t);
        osc.stop(t + 0.12);
    },

    playRep: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t); // A4
        osc.frequency.setValueAtTime(659.25, t + 0.08); // E5

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

        osc.start(t);
        osc.stop(t + 0.22);
    },

    playStep: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx || !SoundSynth.bufferCache['step']) return;
        const t = ctx.currentTime;
        const noise = ctx.createBufferSource();
        noise.buffer = SoundSynth.bufferCache['step'];

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.04);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(t);
    },

    playRoar: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx || !SoundSynth.bufferCache['roar']) return;
        const t = ctx.currentTime;
        const noise = ctx.createBufferSource();
        noise.buffer = SoundSynth.bufferCache['roar'];

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(700, t);
        noiseFilter.frequency.linearRampToValueAtTime(100, t + 0.6);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.08, t);
        noiseGain.gain.linearRampToValueAtTime(0, t + 0.6);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + 0.6);
    }
};

// --- GAME ENTITIES (POOLED - CLASSIC INSIDE GAME BOX) ---

class GroundDetail {
    active: boolean = false;
    x: number = 0;
    y: number = 0;
    width: number = 0;
    height: number = 2;

    spawn(startX: number) {
        this.x = startX;
        this.y = GAME_CONFIG.GROUND_Y + 3 + Math.random() * 45;
        this.width = Math.random() > 0.5 ? 4 : 8;
        this.active = true;
    }

    update(dt: number, speed: number) {
        if (!this.active) return;
        this.x -= speed * dt;
        if (this.x < -this.width) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY; // #535353 on white canvas
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
    }
}

class CactusObstacle {
    active: boolean = false;
    x: number = 0;
    y: number = 210;
    width: number = 0;
    height: number = 0;

    spawn(startX: number) {
        this.x = startX;
        this.width = 18 + Math.random() * 14;
        this.height = 30 + Math.random() * 20;
        this.y = GAME_CONFIG.GROUND_Y - this.height;
        this.active = true;
    }

    update(dt: number, speed: number) {
        if (!this.active) return;
        this.x -= speed * dt;
        if (this.x < -this.width) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        const w = Math.floor(this.width);
        const h = Math.floor(this.height);
        const w3 = Math.floor(w / 3);

        // Classic #535353 obstacle (100% visible on white canvas!)
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;

        // Main stem
        ctx.fillRect(ix + w3, iy, w3, h);
        // Left arm
        ctx.fillRect(ix, iy + 10, w3, 5);
        ctx.fillRect(ix, iy + 5, 5, 10);
        // Right arm
        ctx.fillRect(ix + 2 * w3, iy + 15, w3, 5);
        ctx.fillRect(ix + w - 5, iy + 5, 5, 15);
    }
}

const getFromPool = <T extends { active: boolean }>(pool: T[], factory: () => T): T => {
    const item = pool.find(p => !p.active);
    if (item) return item;
    const newItem = factory();
    pool.push(newItem);
    return newItem;
};

// --- RUNNER ENTITY (CLASSIC #535353 ATHLETE ON WHITE CANVAS) ---

const createRunner = (): RunnerEntity => ({
    x: GAME_CONFIG.RUNNER_START_X,
    y: GAME_CONFIG.RUNNER_GROUND_Y,
    width: 38,
    height: 43,
    dy: 0,
    grounded: false,
    jumpTimer: 0,
    legState: false,
    animTimer: 0,
    isDucking: false,

    reset() {
        this.y = GAME_CONFIG.RUNNER_GROUND_Y;
        this.dy = 0;
        this.grounded = true;
        this.jumpTimer = 0;
        this.legState = false;
        this.animTimer = 0;
        this.isDucking = false;
        this.height = 43;
    },

    jump() {
        if (this.grounded && this.jumpTimer <= 0) {
            this.dy = -GAME_CONFIG.JUMP_FORCE;
            this.grounded = false;
            this.jumpTimer = 0.15;
            this.isDucking = false;
            return true;
        }
        return false;
    },

    duck(ducking: boolean) {
        if (!this.grounded) return;
        this.isDucking = ducking;
        if (ducking) {
            this.height = 26;
            this.y = GAME_CONFIG.RUNNER_DUCK_Y;
        } else {
            this.height = 43;
            this.y = GAME_CONFIG.RUNNER_GROUND_Y;
        }
    },

    update(dt: number, onStep?: () => void) {
        if (this.jumpTimer > 0) this.jumpTimer -= dt;

        this.animTimer += dt;
        if (this.animTimer > 0.1) {
            this.legState = !this.legState;
            this.animTimer = 0;
            if (this.grounded && !this.isDucking && onStep) onStep();
        }

        if (!this.grounded) {
            this.dy += GAME_CONFIG.GRAVITY * dt;
            this.y += this.dy * dt;

            if (this.y >= GAME_CONFIG.RUNNER_GROUND_Y) {
                this.y = GAME_CONFIG.RUNNER_GROUND_Y;
                this.dy = 0;
                this.grounded = true;
            }
        }
    },

    draw(ctx: CanvasRenderingContext2D) {
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY; // #535353 dark on white canvas

        if (this.isDucking && this.grounded) {
            // Squatting / Ducking Runner in #535353
            ctx.fillRect(ix + 18, iy + 2, 12, 10);
            ctx.fillStyle = GAME_CONFIG.CANVAS.EYE; // White eye
            ctx.fillRect(ix + 26, iy + 5, 2, 2);
            ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
            ctx.fillRect(ix + 6, iy + 10, 20, 10);
            ctx.fillRect(ix + 12, iy + 18, 12, 4);
            ctx.fillRect(ix + 2, iy + 16, 8, 10);
            ctx.fillRect(ix + 24, iy + 16, 10, 10);
        } else {
            // Standing / Running / Jumping Runner in #535353
            ctx.fillRect(ix + 14, iy - 6, 12, 12); // Head
            ctx.fillRect(ix + 12, iy - 8, 16, 3); // Headband
            ctx.fillStyle = GAME_CONFIG.CANVAS.EYE; // White eye
            ctx.fillRect(ix + 21, iy - 3, 2, 2);
            ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;

            ctx.fillRect(ix + 17, iy + 6, 6, 3); // Neck
            ctx.fillRect(ix + 12, iy + 9, 16, 16); // Torso

            // Arms Animation
            if (!this.grounded) {
                ctx.fillRect(ix + 6, iy + 6, 4, 10);
                ctx.fillRect(ix + 30, iy + 6, 4, 10);
            } else if (this.legState) {
                ctx.fillRect(ix + 6, iy + 14, 5, 4);
                ctx.fillRect(ix + 29, iy + 10, 5, 4);
            } else {
                ctx.fillRect(ix + 6, iy + 10, 5, 4);
                ctx.fillRect(ix + 29, iy + 14, 5, 4);
            }

            ctx.fillRect(ix + 12, iy + 25, 16, 6); // Shorts

            // Legs Animation
            if (!this.grounded) {
                ctx.fillRect(ix + 12, iy + 31, 6, 7);
                ctx.fillRect(ix + 22, iy + 29, 6, 7);
            } else if (this.legState) {
                ctx.fillRect(ix + 12, iy + 31, 5, 12);
                ctx.fillRect(ix + 10, iy + 41, 7, 2); // Shoe
                ctx.fillRect(ix + 23, iy + 31, 5, 8);
                ctx.fillRect(ix + 25, iy + 37, 6, 2); // Shoe
            } else {
                ctx.fillRect(ix + 23, iy + 31, 5, 12);
                ctx.fillRect(ix + 23, iy + 41, 7, 2); // Shoe
                ctx.fillRect(ix + 12, iy + 31, 5, 8);
                ctx.fillRect(ix + 10, iy + 37, 6, 2); // Shoe
            }
        }
    }
});

// --- COMPONENT PROPS ---

interface DinoGameProps {
    profile?: UserProfile;
    onOpenProgress?: () => void;
    onOpenSettings?: () => void;
    preloadedStream?: MediaStream | null;
}

const DinoGame: React.FC<DinoGameProps> = ({
    profile: propProfile,
    onOpenProgress,
    onOpenSettings,
    preloadedStream,
}) => {
    const profile = propProfile || getUserProfile();

    // --- REFS ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const outputCanvasRef = useRef<HTMLCanvasElement>(null);
    const jumpSignalRef = useRef<HTMLDivElement>(null);

    // --- REACT STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("Stand back from the camera. Jump to leap, squat to duck.");
    const [showVision, setShowVision] = useState(false);
    const [gameRunning, setGameRunning] = useState(false);
    const [canRestart, setCanRestart] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [repFeedback, setRepFeedback] = useState<string>('');

    // Session stats for HUD display
    const [hudCalories, setHudCalories] = useState<number>(0);
    const [hudJumps, setHudJumps] = useState<number>(0);
    const [hudSitStands, setHudSitStands] = useState<number>(0);
    const [hudActiveSeconds, setHudActiveSeconds] = useState<number>(0);

    const mutedRef = useRef(false);

    // --- ENGINE STATE ---
    const engineRef = useRef<GameEngineState>({
        gameRunning: false,
        canRestart: false,
        scoreCalories: 0,
        jumpsCount: 0,
        sitStandsCount: 0,
        activeSeconds: 0,
        gameSpeed: GAME_CONFIG.INITIAL_SPEED,
        lastTime: 0,
        obstaclePool: Array.from({ length: 10 }, () => new CactusObstacle()),
        groundPool: Array.from({ length: 50 }, () => new GroundDetail()),
        spawnTimer: 0,
        groundSpawnTimer: 0,
        animationId: 0,
        visionAnimationId: 0,
        runner: createRunner(),
        hasStarted: false,
        cameraReady: false,
    });

    // --- VISION STATE ---
    const visionRef = useRef<VisionState>({
        poseLandmarker: null,
        lastVideoTime: -1,
        results: undefined,
        prevY: 0,
        prevTime: 0,
        smoothedVelocity: 0,
        peakVelocity: 0,
        JUMP_VELOCITY_THRESHOLD: 2.2,
        lastPredictionTime: 0,
        standingBaselineY: 0.42,
        isCalibrated: false,
        exercisePosture: 'STANDING',
        squatStartTime: 0,
        jumpCooldown: 0,
    });

    useEffect(() => {
        mutedRef.current = isMuted;
    }, [isMuted]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // --- GAME LOGIC ---

    const spawnObstacle = (dt: number) => {
        const engine = engineRef.current;
        engine.spawnTimer -= dt;

        if (engine.spawnTimer <= 0) {
            const r = Math.random();
            const count = r > 0.85 ? 3 : (r > 0.5 ? 2 : 1);
            let nextX = GAME_CONFIG.CANVAS_WIDTH;

            for (let i = 0; i < count; i++) {
                const cactus = getFromPool(engine.obstaclePool, () => new CactusObstacle());
                cactus.spawn(nextX);
                nextX += cactus.width + (8 + Math.random() * 24);
            }

            engine.spawnTimer = 1.0 + (count * 0.4) + Math.random() * 1.2;

            if (engine.gameSpeed < GAME_CONFIG.MAX_SPEED) {
                engine.gameSpeed += GAME_CONFIG.SPEED_INCREMENT;
            }
        }
    };

    const spawnGroundDetails = (dt: number) => {
        const engine = engineRef.current;
        engine.groundSpawnTimer -= dt;
        if (engine.groundSpawnTimer <= 0) {
            const detail = getFromPool(engine.groundPool, () => new GroundDetail());
            detail.spawn(GAME_CONFIG.CANVAS_WIDTH);
            engine.groundSpawnTimer = 0.05 + Math.random() * 0.2;
        }
    };

    const triggerRepVisual = (label: string) => {
        setRepFeedback(label);
        setTimeout(() => setRepFeedback(''), 1200);
    };

    const gameOver = () => {
        const engine = engineRef.current;
        engine.gameRunning = false;
        engine.canRestart = false;

        setGameRunning(false);
        setCanRestart(false);

        if (!mutedRef.current) {
            SoundSynth.playRoar();
        }

        const stats: ExerciseStats = {
            jumps: engine.jumpsCount,
            sitStands: engine.sitStandsCount,
            activeSeconds: Math.round(engine.activeSeconds),
        };
        recordSession(stats, profile);

        setTimeout(() => {
            engine.canRestart = true;
            setCanRestart(true);
        }, 1000);
    };

    const runGameLoop = (timestamp: number) => {
        const engine = engineRef.current;
        if (!engine.gameRunning) return;

        if (!engine.lastTime) engine.lastTime = timestamp;
        const dt = Math.min((timestamp - engine.lastTime) / 1000, 0.1);
        engine.lastTime = timestamp;

        engine.activeSeconds += dt;

        const calorieResult = calculateCalories(
            {
                jumps: engine.jumpsCount,
                sitStands: engine.sitStandsCount,
                activeSeconds: engine.activeSeconds,
            },
            profile.weightKg,
            profile.isGenericWeight
        );
        engine.scoreCalories = calorieResult.totalCalories;

        setHudCalories(calorieResult.totalCalories);
        setHudJumps(engine.jumpsCount);
        setHudSitStands(engine.sitStandsCount);
        setHudActiveSeconds(Math.floor(engine.activeSeconds));

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { alpha: false })!;

        // 1. Draw Canvas Background (White #FFFFFF - Clean & high-contrast!)
        ctx.fillStyle = GAME_CONFIG.CANVAS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Ground Line in #535353
        ctx.strokeStyle = GAME_CONFIG.CANVAS.GROUND;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GAME_CONFIG.GROUND_Y);
        ctx.lineTo(canvas.width, GAME_CONFIG.GROUND_Y);
        ctx.stroke();

        // 3. Ground Details in #535353
        spawnGroundDetails(dt);
        for (let i = 0; i < engine.groundPool.length; i++) {
            const detail = engine.groundPool[i];
            if (detail.active) {
                detail.update(dt, engine.gameSpeed);
                detail.draw(ctx);
            }
        }

        // 4. Runner Entity in #535353
        engine.runner.update(dt, () => {
            if (!mutedRef.current) SoundSynth.playStep();
        });
        engine.runner.draw(ctx);

        // 5. Obstacles & Collision Detection
        spawnObstacle(dt);
        const runner = engine.runner;
        const padding = 8;

        for (let i = 0; i < engine.obstaclePool.length; i++) {
            const obs = engine.obstaclePool[i];
            if (obs.active) {
                obs.update(dt, engine.gameSpeed);
                obs.draw(ctx);

                if (
                    runner.x < obs.x + obs.width - padding &&
                    runner.x + runner.width > obs.x + padding &&
                    runner.y < obs.y + obs.height - padding &&
                    runner.y + runner.height > obs.y + padding
                ) {
                    gameOver();
                }
            }
        }

        // 6. Draw HUD on Canvas in #535353 (Dark text on light canvas: 100% visible and sharp!)
        if (engine.gameRunning) {
            ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
            ctx.font = "bold 15px 'Playfair Display', Georgia, serif";
            ctx.textAlign = "right";
            const calText = `${Math.floor(engine.scoreCalories)} KCAL`;
            ctx.fillText(calText, canvas.width - 20, 32);

            ctx.font = "500 12px 'Lora', Georgia, serif";
            const repText = `Jumps: ${engine.jumpsCount}  ·  Squats: ${engine.sitStandsCount}`;
            ctx.fillText(repText, canvas.width - 20, 52);

            engine.animationId = requestAnimationFrame(runGameLoop);
        }
    };

    const resetGame = () => {
        const engine = engineRef.current;

        engine.obstaclePool.forEach(p => p.active = false);
        engine.groundPool.forEach(p => p.active = false);

        for (let x = 0; x < GAME_CONFIG.CANVAS_WIDTH; x += 30 + Math.random() * 60) {
            const detail = getFromPool(engine.groundPool, () => new GroundDetail());
            detail.spawn(x);
        }

        engine.scoreCalories = 0;
        engine.jumpsCount = 0;
        engine.sitStandsCount = 0;
        engine.activeSeconds = 0;
        engine.canRestart = false;
        engine.gameSpeed = GAME_CONFIG.INITIAL_SPEED;
        engine.spawnTimer = 0;
        engine.groundSpawnTimer = 0;
        engine.runner.reset();
        engine.lastTime = 0;
        engine.gameRunning = true;

        setHudCalories(0);
        setHudJumps(0);
        setHudSitStands(0);
        setHudActiveSeconds(0);
        setGameRunning(true);
        setCanRestart(false);

        runGameLoop(0);
    };

    const manualStart = () => {
        SoundSynth.init();
        setHasStarted(true);
        engineRef.current.hasStarted = true;
        resetGame();
    };

    // --- MOVEMENT SIGNALS & EXERCISE TRANSLATION ---

    const handleJumpSignal = useCallback(() => {
        const engine = engineRef.current;
        const vision = visionRef.current;

        if (vision.jumpCooldown > 0 || vision.exercisePosture === 'SQUATTING') {
            return;
        }

        vision.jumpCooldown = 0.55;

        if (jumpSignalRef.current) {
            jumpSignalRef.current.classList.add('active');
            setTimeout(() => jumpSignalRef.current?.classList.remove('active'), 200);
        }

        if (engine.gameRunning) {
            const jumped = engine.runner.jump();
            if (jumped) {
                engine.jumpsCount += 1;
                triggerRepVisual('+1 JUMP');
                if (!mutedRef.current) SoundSynth.playJump();
            }
        } else if (!engine.gameRunning && engine.canRestart) {
            resetGame();
        } else if (!engine.hasStarted && engine.cameraReady) {
            manualStart();
        }
    }, []);

    const handleSitStandRep = useCallback(() => {
        const engine = engineRef.current;
        engine.sitStandsCount += 1;
        triggerRepVisual('+1 SQUAT');
        if (!mutedRef.current) SoundSynth.playRep();
    }, []);

    // Manual Keyboard and Touch Controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                handleJumpSignal();
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                engineRef.current.runner.duck(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                engineRef.current.runner.duck(false);
                if (engineRef.current.gameRunning) {
                    handleSitStandRep();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleJumpSignal, handleSitStandRep]);

    const calibrateStandingHeight = () => {
        const state = visionRef.current;
        if (state.prevY > 0) {
            state.standingBaselineY = state.prevY;
            state.isCalibrated = true;
            setStatus(`Standing height calibrated (${state.prevY.toFixed(2)})`);
        } else {
            setStatus("Please stand within the camera view and click calibrate.");
        }
    };

    // --- VISION LOGIC (MEDIAPIPE POSE) ---

    const predictWebcam = () => {
        const video = videoRef.current;
        const outCanvas = outputCanvasRef.current;
        const engine = engineRef.current;
        const state = visionRef.current;

        if (!video || !outCanvas || !state.poseLandmarker) {
            engine.visionAnimationId = requestAnimationFrame(predictWebcam);
            return;
        }

        const now = performance.now();
        const timeSinceLast = now - state.lastPredictionTime;
        const frameInterval = 1000 / GAME_CONFIG.VISION_FPS;

        if (timeSinceLast < frameInterval) {
            engine.visionAnimationId = requestAnimationFrame(predictWebcam);
            return;
        }
        state.lastPredictionTime = now;

        if (state.jumpCooldown > 0) {
            state.jumpCooldown -= (timeSinceLast / 1000);
        }

        const { poseLandmarker } = state;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
            if (outCanvas.width !== video.videoWidth || outCanvas.height !== video.videoHeight) {
                outCanvas.width = video.videoWidth;
                outCanvas.height = video.videoHeight;
            }
        }

        const outCtx = outCanvas.getContext('2d', { alpha: true })!;
        let didUpdate = false;

        if (state.lastVideoTime !== video.currentTime) {
            state.lastVideoTime = video.currentTime;
            state.results = poseLandmarker.detectForVideo(video, now);
            didUpdate = true;
        }

        outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);

        if (state.results && state.results.landmarks && state.results.landmarks.length > 0) {
            const landmarks = state.results.landmarks[0];
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];

            outCtx.beginPath();
            outCtx.moveTo(leftShoulder.x * outCanvas.width, leftShoulder.y * outCanvas.height);
            outCtx.lineTo(rightShoulder.x * outCanvas.width, rightShoulder.y * outCanvas.height);
            outCtx.strokeStyle = GAME_CONFIG.PAGE.ACCENT;
            outCtx.lineWidth = 3;
            outCtx.stroke();

            outCtx.fillStyle = GAME_CONFIG.PAGE.TEXT;
            const shoulders = [leftShoulder, rightShoulder];
            for (let i = 0; i < shoulders.length; i++) {
                outCtx.beginPath();
                outCtx.arc(shoulders[i].x * outCanvas.width, shoulders[i].y * outCanvas.height, 5, 0, 2 * Math.PI);
                outCtx.fill();
            }

            if (didUpdate) {
                const currentY = (leftShoulder.y + rightShoulder.y) / 2;
                const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

                if (!state.isCalibrated && currentY > 0.1 && currentY < 0.9) {
                    state.standingBaselineY = currentY;
                    state.isCalibrated = true;
                }

                const currentTime = video.currentTime;
                let currentVelocity = 0;

                if (state.prevTime > 0 && currentTime > state.prevTime) {
                    const dt = currentTime - state.prevTime;
                    const dy = state.prevY - currentY;
                    const normalizedDy = dy / Math.max(0.08, shoulderDist);
                    currentVelocity = normalizedDy / dt;
                }

                state.smoothedVelocity = state.smoothedVelocity * 0.5 + currentVelocity * 0.5;

                if (state.smoothedVelocity > state.peakVelocity) {
                    state.peakVelocity = state.smoothedVelocity;
                } else {
                    state.peakVelocity *= 0.95;
                }

                state.prevY = currentY;
                state.prevTime = currentTime;

                if (state.smoothedVelocity > state.JUMP_VELOCITY_THRESHOLD && state.jumpCooldown <= 0) {
                    handleJumpSignal();
                }

                const squatThreshold = 0.09;
                const standReturnThreshold = 0.04;

                if (state.exercisePosture === 'STANDING') {
                    if (currentY > state.standingBaselineY + squatThreshold && state.jumpCooldown <= 0) {
                        state.exercisePosture = 'SQUATTING';
                        state.squatStartTime = now;
                        engine.runner.duck(true);
                    }
                } else if (state.exercisePosture === 'SQUATTING') {
                    engine.runner.duck(true);

                    if (currentY < state.standingBaselineY + standReturnThreshold) {
                        const squatDuration = (now - state.squatStartTime) / 1000;
                        if (squatDuration >= 0.3) {
                            state.exercisePosture = 'STANDING';
                            engine.runner.duck(false);
                            handleSitStandRep();
                        } else {
                            state.exercisePosture = 'STANDING';
                            engine.runner.duck(false);
                        }
                    }
                }
            }

            drawDebugOverlay(outCtx, state);
        }

        engine.visionAnimationId = requestAnimationFrame(predictWebcam);
    };

    const drawDebugOverlay = (ctx: CanvasRenderingContext2D, state: VisionState) => {
        const barH = 100;
        const barW = 14;
        const barX = 20;
        const barY = 50;
        const maxVal = state.JUMP_VELOCITY_THRESHOLD * 1.5;

        ctx.fillStyle = 'rgba(21, 25, 28, 0.6)';
        ctx.fillRect(barX, barY, barW, barH);

        const threshPixel = (state.JUMP_VELOCITY_THRESHOLD / maxVal) * barH;
        const threshY = barY + barH - threshPixel;
        ctx.fillStyle = GAME_CONFIG.PAGE.DANGER;
        ctx.fillRect(barX - 4, threshY, barW + 8, 2);

        const fillRatio = Math.min(Math.max(state.smoothedVelocity / maxVal, 0), 1);
        const currentH = fillRatio * barH;

        ctx.fillStyle = state.smoothedVelocity > state.JUMP_VELOCITY_THRESHOLD ? GAME_CONFIG.PAGE.ACCENT : '#7E8B95';
        ctx.fillRect(barX, barY + barH - currentH, barW, currentH);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.fillStyle = GAME_CONFIG.PAGE.TEXT;
        ctx.font = "500 11px 'Lora', Georgia, serif";
        ctx.fillText(`Velocity: ${state.smoothedVelocity.toFixed(1)}`, -(barX + 90), barY + barH + 18);
        ctx.fillStyle = state.exercisePosture === 'SQUATTING' ? GAME_CONFIG.PAGE.ACCENT : GAME_CONFIG.PAGE.TEXT;
        ctx.fillText(`Posture: ${state.exercisePosture}`, -(barX + 90), barY + barH + 34);
        ctx.restore();
    };

    const enableCam = async () => {
        SoundSynth.init();
        if (!visionRef.current.poseLandmarker) return;

        try {
            const stream = preloadedStream || await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", () => {
                    predictWebcam();
                    setCameraReady(true);
                    engineRef.current.cameraReady = true;
                    setStatus("Camera active! JUMP to leap, SQUAT to duck & count reps.");
                });
            }
        } catch (err) {
            console.error('Camera activation failed:', err);
            setStatus("Camera unavailable. Play using Spacebar (Jump) and Down Arrow (Squat)!");
        }
    };

    useEffect(() => {
        let isCancelled = false;

        const initMediaPipe = async () => {
            try {
                // @ts-ignore
                const { PoseLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm");

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
                );

                if (isCancelled) return;

                visionRef.current.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1
                });

                setIsLoading(false);
                setModelLoaded(true);

                if (preloadedStream) {
                    enableCam();
                }
            } catch (err) {
                console.error("MediaPipe initialization error:", err);
                setIsLoading(false);
                setStatus("Motion tracking offline. Keyboard controls (Space / Down Arrow) active.");
            }
        };

        initMediaPipe();

        return () => {
            isCancelled = true;
            cancelAnimationFrame(engineRef.current.animationId);
            cancelAnimationFrame(engineRef.current.visionAnimationId);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="flex flex-col items-center gap-4 w-full max-w-4xl relative font-serif">
            
            {/* TOP COMPACT HUD (OUTSIDE THE BOX: Dark #1E2328 with Light Text #ECEFF2 & Accent #F7B83D) */}
            <div className="w-full flex flex-wrap items-center justify-between text-sm border border-hitfit-border bg-hitfit-surface px-4 py-3 rounded-xl shadow-md">
                <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-base text-hitfit-accent tracking-wide">
                        {Math.floor(hudCalories)} KCAL
                    </span>
                    <span className="text-xs text-hitfit-muted font-serif">
                        {profile.isGenericWeight ? '(Est. 70kg)' : '(Personalized)'}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-hitfit-muted">
                    <span>Jumps: <strong className="text-hitfit-text font-serif">{hudJumps}</strong></span>
                    <span>Squats: <strong className="text-hitfit-text font-serif">{hudSitStands}</strong></span>
                    <span>Active Time: <strong className="text-hitfit-text font-serif">{formatTime(hudActiveSeconds)}</strong></span>
                </div>
            </div>

            {/* GAME CANVAS WRAPPER */}
            <div className="relative w-full flex justify-center">
                
                {/* THE GAME BOX (INSIDE: Classic White Canvas with Dark #535353 Elements - 100% VISIBLE!) */}
                <canvas
                    ref={canvasRef}
                    width={GAME_CONFIG.CANVAS_WIDTH}
                    height={GAME_CONFIG.CANVAS_HEIGHT}
                    className="bg-white border-2 border-hitfit-border rounded-xl shadow-2xl max-w-full cursor-pointer"
                    onClick={() => {
                        if (gameRunning) handleJumpSignal();
                    }}
                />

                {/* ON-CANVAS EXERCISE FEEDBACK POPUP */}
                {repFeedback && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#535353] text-white px-4 py-1.5 text-xs font-heading font-bold rounded-full border border-white/40 shadow-lg animate-bounce pointer-events-none z-30">
                        {repFeedback}
                    </div>
                )}

                {/* MUTE BUTTON (Inside light game box: Dark #535353 icon on White bg) */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="group absolute top-3 left-3 z-20 w-8 h-8 text-[#535353] hover:text-black transition-colors p-1.5 border border-[#535353]/30 bg-white/90 hover:bg-white backdrop-blur rounded-lg shadow-sm"
                    aria-label={isMuted ? "Unmute sound" : "Mute sound"}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    )}
                </button>

                {/* CALIBRATE BUTTON (Inside light game box: Dark text on White bg) */}
                {cameraReady && (
                    <button
                        onClick={calibrateStandingHeight}
                        className="absolute top-3 left-13 z-20 px-2.5 py-1.5 text-[11px] text-[#535353] hover:text-black border border-[#535353]/30 bg-white/90 hover:bg-white backdrop-blur rounded-lg transition-colors cursor-pointer"
                        title="Calibrate standing height"
                    >
                        Calibrate
                    </button>
                )}

                {/* START SCREEN OVERLAY (Light background -> Dark text) */}
                {(!gameRunning && !canRestart && !hasStarted) && (
                    <div className="absolute top-0 left-0 w-full h-full bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl p-6 text-center">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-3 border-gray-200 border-t-[#535353] rounded-full animate-spin"></div>
                                <p className="text-sm font-serif text-[#535353]">Loading camera vision model...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3.5 max-w-md">
                                <h2 className="text-xl md:text-2xl font-heading font-bold text-[#15191C]">
                                    Hit the Target to Be Fit
                                </h2>
                                <p className="text-xs text-[#535353] leading-relaxed">
                                    Your webcam tracks physical jumps and squats. Jump over hurdles and squat to duck beneath high obstacles.
                                </p>

                                {!cameraReady ? (
                                    <button
                                        onClick={enableCam}
                                        className="px-6 py-3 bg-[#15191C] hover:bg-[#2E363E] text-[#ECEFF2] font-heading font-semibold text-sm rounded-xl shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
                                    >
                                        Enable Camera & Start
                                    </button>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <button
                                            onClick={manualStart}
                                            className="px-7 py-3.5 bg-[#15191C] hover:bg-[#2E363E] text-[#F7B83D] font-heading font-bold text-sm rounded-xl shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5 border border-[#15191C]"
                                        >
                                            Start Workout
                                        </button>
                                        <p className="text-xs text-[#535353] font-semibold animate-pulse">
                                            or Jump to start playing
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* GAME OVER SCREEN OVERLAY (Dark backdrop -> Light text; White card -> Dark text) */}
                {(hasStarted && !gameRunning) && (
                    <div className="absolute top-0 left-0 w-full h-full bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl text-center p-6">
                        <h2 className="text-2xl md:text-3xl font-heading font-bold text-white mb-1 drop-shadow">
                            Workout Complete
                        </h2>
                        <p className="text-xs font-serif text-[#F7B83D] italic mb-4">
                            Hit the target to be fit.
                        </p>

                        {/* Session Results Card (Light card -> Dark text #15191C!) */}
                        <div className="bg-white border border-gray-200 text-[#15191C] p-4 mb-4 text-xs rounded-xl space-y-1.5 shadow-xl max-w-sm w-full">
                            <div className="font-heading font-bold text-lg text-[#15191C]">
                                {hudCalories} Estimated kcal
                            </div>
                            <div className="text-[#535353]">Total Jumps: <strong className="text-[#15191C]">{hudJumps}</strong></div>
                            <div className="text-[#535353]">Squat Reps: <strong className="text-[#15191C]">{hudSitStands}</strong></div>
                            <div className="text-[#535353]">Duration: <strong className="text-[#15191C]">{formatTime(hudActiveSeconds)}</strong></div>
                            {profile.isGenericWeight && (
                                <div className="text-[10px] text-[#888] pt-1.5 border-t border-gray-200">
                                    Calculated using generic 70 kg reference.
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <button
                                onClick={resetGame}
                                disabled={!canRestart}
                                className="px-5 py-2.5 bg-[#F7B83D] hover:bg-[#E5A52A] text-[#15191C] font-heading font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
                            >
                                {canRestart ? "Play Again (or Jump)" : "Saving Activity..."}
                            </button>

                            {onOpenProgress && (
                                <button
                                    onClick={onOpenProgress}
                                    className="px-5 py-2.5 bg-white hover:bg-gray-100 text-[#15191C] font-heading font-semibold text-xs rounded-xl transition-colors cursor-pointer border border-white"
                                >
                                    View Today's Progress
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* STATUS & FEEDBACK (OUTSIDE: Light text #ECEFF2 on Dark #15191C) */}
            <div className="text-xs text-hitfit-text min-h-[1.25rem] text-center w-full px-2">
                {status}
            </div>

            {/* MOBILE TOUCH CONTROLS (OUTSIDE: Dark buttons #1E2328 with Light text #ECEFF2) */}
            <div className="w-full flex items-center justify-center gap-3 pt-1">
                <button
                    onClick={handleJumpSignal}
                    className="flex-1 max-w-[170px] py-2.5 bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent text-xs font-serif rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                    Jump (Space)
                </button>
                <button
                    onMouseDown={() => engineRef.current.runner.duck(true)}
                    onMouseUp={() => {
                        engineRef.current.runner.duck(false);
                        if (engineRef.current.gameRunning) handleSitStandRep();
                    }}
                    onTouchStart={() => engineRef.current.runner.duck(true)}
                    onTouchEnd={() => {
                        engineRef.current.runner.duck(false);
                        if (engineRef.current.gameRunning) handleSitStandRep();
                    }}
                    className="flex-1 max-w-[170px] py-2.5 bg-hitfit-surface border border-hitfit-border hover:border-hitfit-accent text-hitfit-text hover:text-hitfit-accent text-xs font-serif rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                    Squat / Duck (↓)
                </button>
            </div>

            {/* CAMERA FEED TOGGLE */}
            <div className="text-xs text-hitfit-muted text-center flex items-center justify-center gap-2">
                <label className="cursor-pointer flex items-center hover:text-hitfit-text transition-colors">
                    <input
                        type="checkbox"
                        checked={showVision}
                        onChange={(e) => setShowVision(e.target.checked)}
                        className="mr-2 w-3.5 h-3.5 accent-[#F7B83D] cursor-pointer"
                    />
                    <span>Show Real-Time Motion Tracking Feed</span>
                </label>
            </div>

            {/* VISION CONTAINER */}
            <div
                className={`relative w-[320px] h-[240px] border border-hitfit-border rounded-xl overflow-hidden bg-black shadow-lg ${showVision ? 'block' : 'hidden'}`}
            >
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                ></video>
                <canvas
                    ref={outputCanvasRef}
                    className="absolute top-0 left-0 w-full h-full scale-x-[-1]"
                ></canvas>
                <div
                    ref={jumpSignalRef}
                    className="absolute top-3 right-3 w-4 h-4 bg-hitfit-border rounded-full transition-all duration-100 [&.active]:bg-hitfit-accent [&.active]:shadow-[0_0_12px_#F7B83D]"
                ></div>
            </div>
        </div>
    );
};

export default DinoGame;