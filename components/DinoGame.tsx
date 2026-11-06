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
    ExerciseStats
} from '../services/fitnessEngine';

// --- TYPES & INTERFACES ---

interface ExtendedWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
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
    GRAVITY: 3800,
    JUMP_FORCE: 960,
    INITIAL_SPEED: 380,
    MAX_SPEED: 1050,
    SPEED_INCREMENT: 6,
    RUNNER_START_X: 60,
    RUNNER_GROUND_Y: 199,
    RUNNER_DUCK_Y: 216,
    // INSIDE THE GAME BOX: Crisp light canvas with dark #535353 monochrome elements
    CANVAS: {
        BG: '#FFFFFF',
        PRIMARY: '#535353',
        TEXT: '#535353',
        GROUND: '#535353',
        EYE: '#FFFFFF',
    },
    // OUTSIDE THE GAME BOX: HitFit dark palette
    PAGE: {
        BG: '#15191C',
        SURFACE: '#1E2328',
        BORDER: '#2E363E',
        TEXT: '#ECEFF2',
        MUTED: '#9AA6B2',
        ACCENT: '#F7B83D',
        ACCENT_HOVER: '#E5A52A',
    }
};

// --- AUDIO SYNTHESIS ---

const SoundSynth = {
    ctx: null as AudioContext | null,

    init: () => {
        if (!SoundSynth.ctx) {
            const Win = window as ExtendedWindow;
            SoundSynth.ctx = new (window.AudioContext || Win.webkitAudioContext)();
        }
        if (SoundSynth.ctx.state === 'suspended') {
            SoundSynth.ctx.resume();
        }
    },

    playJump: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.15);
    },

    playRep: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.08); // E5

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.23);
    },

    playStep: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, t);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.05);
    },

    playGameOver: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.35);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.4);
    }
};

// --- GAME ENTITIES ---

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
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
    }
}

class CactusObstacle {
    type: 'cactus' = 'cactus';
    active: boolean = false;
    x: number = 0;
    y: number = 210;
    width: number = 0;
    height: number = 0;

    spawn(startX: number) {
        this.x = startX;
        this.width = 18 + Math.random() * 12;
        this.height = 32 + Math.random() * 16;
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

        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
        ctx.fillRect(ix + w3, iy, w3, h);
        ctx.fillRect(ix, iy + 10, w3, 5);
        ctx.fillRect(ix, iy + 5, 5, 10);
        ctx.fillRect(ix + 2 * w3, iy + 14, w3, 5);
        ctx.fillRect(ix + w - 5, iy + 5, 5, 14);
    }
}

class BirdObstacle {
    type: 'bird' = 'bird';
    active: boolean = false;
    x: number = 0;
    y: number = 175; // Flies at head height (requires squat/duck)
    width: number = 42;
    height: number = 28;
    animTimer: number = 0;
    wingUp: boolean = false;

    spawn(startX: number) {
        this.x = startX;
        // Head height so standing runner collides, but ducking runner passes safely underneath
        this.y = GAME_CONFIG.GROUND_Y - 68; // ~174
        this.active = true;
        this.animTimer = 0;
        this.wingUp = false;
    }

    update(dt: number, speed: number) {
        if (!this.active) return;
        // Birds fly slightly faster than the ground speed
        this.x -= (speed + 45) * dt;
        if (this.x < -this.width) this.active = false;

        this.animTimer += dt;
        if (this.animTimer > 0.16) {
            this.wingUp = !this.wingUp;
            this.animTimer = 0;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);

        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;

        // Bird Body & Beak
        ctx.fillRect(ix + 12, iy + 10, 20, 8); // Body
        ctx.fillRect(ix + 2, iy + 12, 10, 4);  // Head & Beak
        ctx.fillRect(ix + 32, iy + 12, 8, 4);  // Tail

        // Flapping Wings Animation
        if (this.wingUp) {
            ctx.fillRect(ix + 16, iy, 8, 10);
            ctx.fillRect(ix + 20, iy - 4, 6, 4);
        } else {
            ctx.fillRect(ix + 16, iy + 18, 8, 10);
            ctx.fillRect(ix + 20, iy + 28, 6, 4);
        }

        // Eye
        ctx.fillStyle = GAME_CONFIG.CANVAS.EYE;
        ctx.fillRect(ix + 6, iy + 12, 2, 2);
    }
}

type AnyObstacle = CactusObstacle | BirdObstacle;

// --- RUNNER ENTITY (ATHLETE IN #535353) ---

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
        this.animTimer = 0;
        this.legState = false;
        this.isDucking = false;
        this.height = 43;
    },

    jump() {
        if (this.grounded && !this.isDucking) {
            this.dy = -GAME_CONFIG.JUMP_FORCE;
            this.grounded = false;
            this.jumpTimer = 0;
            return true;
        }
        return false;
    },

    duck(ducking: boolean) {
        this.isDucking = ducking;
        if (ducking && this.grounded) {
            this.height = 26;
            this.y = GAME_CONFIG.RUNNER_DUCK_Y;
        } else if (!ducking && this.grounded) {
            this.height = 43;
            this.y = GAME_CONFIG.RUNNER_GROUND_Y;
        }
    },

    update(dt: number, onStep?: () => void) {
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
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;

        if (this.isDucking && this.grounded) {
            // Squatting / Ducking Human Runner
            ctx.fillRect(ix + 18, iy + 2, 12, 10); // Head
            ctx.fillStyle = GAME_CONFIG.CANVAS.EYE;
            ctx.fillRect(ix + 26, iy + 5, 2, 2);
            ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
            ctx.fillRect(ix + 6, iy + 10, 20, 10);  // Torso low
            ctx.fillRect(ix + 12, iy + 18, 12, 4);
            ctx.fillRect(ix + 2, iy + 16, 8, 10);   // Bent knees
            ctx.fillRect(ix + 24, iy + 16, 10, 10);
        } else {
            // Standing Human Runner
            ctx.fillRect(ix + 14, iy - 6, 12, 12); // Head
            ctx.fillRect(ix + 12, iy - 8, 16, 3);  // Headband
            ctx.fillStyle = GAME_CONFIG.CANVAS.EYE;
            ctx.fillRect(ix + 21, iy - 3, 2, 2);
            ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;

            ctx.fillRect(ix + 17, iy + 6, 6, 3);   // Neck
            ctx.fillRect(ix + 12, iy + 9, 16, 16); // Torso

            // Arms
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

            // Legs
            if (!this.grounded) {
                ctx.fillRect(ix + 12, iy + 31, 6, 7);
                ctx.fillRect(ix + 22, iy + 29, 6, 7);
            } else if (this.legState) {
                ctx.fillRect(ix + 12, iy + 31, 5, 12);
                ctx.fillRect(ix + 10, iy + 41, 7, 2);
                ctx.fillRect(ix + 23, iy + 31, 5, 8);
                ctx.fillRect(ix + 25, iy + 37, 6, 2);
            } else {
                ctx.fillRect(ix + 23, iy + 31, 5, 12);
                ctx.fillRect(ix + 23, iy + 41, 7, 2);
                ctx.fillRect(ix + 12, iy + 31, 5, 8);
                ctx.fillRect(ix + 10, iy + 37, 6, 2);
            }
        }
    }
});

// --- COMPONENT PROPS ---

interface DinoGameProps {
    profile?: UserProfile;
    onOpenProgress?: () => void;
    onOpenSettings?: () => void;
    onOpenAbout?: () => void;
    preloadedStream?: MediaStream | null;
    soundEnabled?: boolean;
    onStreamReady?: (stream: MediaStream) => void;
}

const DinoGame: React.FC<DinoGameProps> = ({
    profile: propProfile,
    onOpenProgress,
    onOpenSettings,
    onOpenAbout,
    preloadedStream,
    soundEnabled = true,
    onStreamReady
}) => {
    const profile = propProfile || getUserProfile();

    // DOM Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const motionCanvasRef = useRef<HTMLCanvasElement>(null);

    // React state
    const [cameraActive, setCameraActive] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string>('');
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    const [gameRunning, setGameRunning] = useState<boolean>(false);
    const [canRestart, setCanRestart] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Live HUD metrics
    const [hudCalories, setHudCalories] = useState<number>(0);
    const [hudJumps, setHudJumps] = useState<number>(0);
    const [hudSitStands, setHudSitStands] = useState<number>(0);
    const [hudActiveSeconds, setHudActiveSeconds] = useState<number>(0);
    const [repVisual, setRepVisual] = useState<string | null>(null);
    const [motionDot, setMotionDot] = useState<boolean>(false);

    // Engine mutable state
    const engineRef = useRef({
        gameRunning: false,
        canRestart: false,
        scoreCalories: 0,
        jumpsCount: 0,
        sitStandsCount: 0,
        activeSeconds: 0,
        gameSpeed: GAME_CONFIG.INITIAL_SPEED,
        lastTime: 0,
        obstaclePool: [] as AnyObstacle[],
        groundPool: [] as GroundDetail[],
        spawnTimer: 0,
        totalObstaclesSpawned: 0,
        runner: createRunner(),
        animationId: 0,
        cameraStream: null as MediaStream | null,
    });

    // Lightweight Optical & Centroid Motion Tracker State
    const trackerRef = useRef({
        prevFrameData: null as Uint8ClampedArray | null,
        baselineY: 0.45,
        currentY: 0.45,
        isCalibrated: false,
        prevCentroidY: 0.45,
        smoothedVelocity: 0,
        jumpCooldown: 0,
        squatState: 'STANDING' as 'STANDING' | 'SQUATTING',
        squatStartTime: 0,
        trackingLoopId: 0,
        lastTime: performance.now(),
        detectionType: 'optical' as 'optical' | 'pose',
        poseLandmarker: null as any,
    });

    // Sound toggle ref
    const mutedRef = useRef(!soundEnabled);
    useEffect(() => {
        mutedRef.current = !soundEnabled;
    }, [soundEnabled]);

    const triggerRepVisual = (text: string) => {
        setRepVisual(text);
        setTimeout(() => setRepVisual(null), 850);
    };

    // --- GAME LIFECYCLE ---

    const manualStart = () => {
        SoundSynth.init();
        setHasStarted(true);
        resetGame();
    };

    const gameOver = () => {
        const engine = engineRef.current;
        engine.gameRunning = false;
        setGameRunning(false);
        setCanRestart(false);
        if (!mutedRef.current) SoundSynth.playGameOver();

        cancelAnimationFrame(engine.animationId);

        // Record fitness session locally
        const stats: ExerciseStats = {
            jumps: engine.jumpsCount,
            sitStands: engine.sitStandsCount,
            activeSeconds: Math.floor(engine.activeSeconds),
        };

        recordSession(stats, profile);

        setTimeout(() => {
            engine.canRestart = true;
            setCanRestart(true);
        }, 900);
    };

    const resetGame = () => {
        const engine = engineRef.current;
        engine.obstaclePool = [];
        engine.groundPool = [];
        engine.gameSpeed = GAME_CONFIG.INITIAL_SPEED;
        engine.scoreCalories = 0;
        engine.jumpsCount = 0;
        engine.sitStandsCount = 0;
        engine.activeSeconds = 0;
        engine.spawnTimer = 1.2;
        engine.totalObstaclesSpawned = 0;
        engine.runner.reset();
        engine.lastTime = performance.now();

        setHudCalories(0);
        setHudJumps(0);
        setHudSitStands(0);
        setHudActiveSeconds(0);
        setGameRunning(true);
        engine.gameRunning = true;

        cancelAnimationFrame(engine.animationId);
        engine.animationId = requestAnimationFrame(runGameLoop);
    };

    // --- OBSTACLE SPAWNER (EARLY BIRDS FOR SQUATS!) ---

    const spawnObstacle = (dt: number) => {
        const engine = engineRef.current;
        engine.spawnTimer -= dt;

        if (engine.spawnTimer <= 0) {
            engine.totalObstaclesSpawned += 1;

            // Birds start coming early (from obstacle #2 onwards) so squats are frequently required!
            const canSpawnBird = engine.totalObstaclesSpawned >= 2;
            const isBird = canSpawnBird && Math.random() < 0.42;

            if (isBird) {
                const bird = new BirdObstacle();
                bird.spawn(GAME_CONFIG.CANVAS_WIDTH + 10);
                engine.obstaclePool.push(bird);
            } else {
                const cactus = new CactusObstacle();
                cactus.spawn(GAME_CONFIG.CANVAS_WIDTH + 10);
                engine.obstaclePool.push(cactus);
            }

            // Balanced spacing for athletic reaction time
            const minInterval = Math.max(1.3, 2.5 - (engine.gameSpeed - GAME_CONFIG.INITIAL_SPEED) / 500);
            const variation = 0.8 + Math.random() * 0.9;
            engine.spawnTimer = minInterval + variation;
        }
    };

    const spawnGroundDetails = (dt: number) => {
        const engine = engineRef.current;
        if (Math.random() < 0.35) {
            const detail = new GroundDetail();
            detail.spawn(GAME_CONFIG.CANVAS_WIDTH + 10);
            engine.groundPool.push(detail);
        }
    };

    // --- MAIN GAME LOOP (SILKY SMOOTH 60 FPS) ---

    const runGameLoop = (timestamp: number) => {
        const engine = engineRef.current;
        if (!engine.gameRunning) return;

        let dt = (timestamp - engine.lastTime) / 1000;
        engine.lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;
        if (dt <= 0) {
            engine.animationId = requestAnimationFrame(runGameLoop);
            return;
        }

        engine.activeSeconds += dt;
        engine.gameSpeed = Math.min(
            GAME_CONFIG.MAX_SPEED,
            engine.gameSpeed + GAME_CONFIG.SPEED_INCREMENT * dt
        );

        // Calculate MET-based calories live
        const currentStats: ExerciseStats = {
            jumps: engine.jumpsCount,
            sitStands: engine.sitStandsCount,
            activeSeconds: engine.activeSeconds,
        };
        const cal = calculateCalories(
            currentStats,
            profile.weightKg,
            profile.isGenericWeight
        );
        engine.scoreCalories = cal.totalCalories;

        setHudCalories(cal.totalCalories);
        setHudJumps(engine.jumpsCount);
        setHudSitStands(engine.sitStandsCount);
        setHudActiveSeconds(Math.floor(engine.activeSeconds));

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // 1. Draw Canvas Background (Crisp light #FFFFFF inside game box)
        ctx.fillStyle = GAME_CONFIG.CANVAS.BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Ground Line
        ctx.strokeStyle = GAME_CONFIG.CANVAS.GROUND;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GAME_CONFIG.GROUND_Y);
        ctx.lineTo(canvas.width, GAME_CONFIG.GROUND_Y);
        ctx.stroke();

        // 3. Ground Details
        spawnGroundDetails(dt);
        for (let i = engine.groundPool.length - 1; i >= 0; i--) {
            const g = engine.groundPool[i];
            if (g.active) {
                g.update(dt, engine.gameSpeed);
                g.draw(ctx);
            } else {
                engine.groundPool.splice(i, 1);
            }
        }

        // 4. Update Runner
        engine.runner.update(dt, () => {
            if (!mutedRef.current) SoundSynth.playStep();
        });
        engine.runner.draw(ctx);

        // 5. Update Obstacles & Collision Check
        spawnObstacle(dt);
        const runner = engine.runner;
        const padX = 7;
        const padY = 5;

        for (let i = engine.obstaclePool.length - 1; i >= 0; i--) {
            const obs = engine.obstaclePool[i];
            if (obs.active) {
                obs.update(dt, engine.gameSpeed);
                obs.draw(ctx);

                // Precise AABB Collision
                if (
                    runner.x < obs.x + obs.width - padX &&
                    runner.x + runner.width > obs.x + padX &&
                    runner.y < obs.y + obs.height - padY &&
                    runner.y + runner.height > obs.y + padY
                ) {
                    gameOver();
                    return;
                }
            } else {
                engine.obstaclePool.splice(i, 1);
            }
        }

        // 6. Canvas HUD Metrics (Crisp #535353 text on light canvas)
        ctx.fillStyle = GAME_CONFIG.CANVAS.PRIMARY;
        ctx.textAlign = 'right';

        ctx.font = "bold 15px 'Playfair Display', Georgia, serif";
        ctx.fillText(`${Math.floor(engine.scoreCalories)} KCAL`, canvas.width - 20, 30);

        ctx.font = "500 12px 'Lora', Georgia, serif";
        ctx.fillText(`Jumps: ${engine.jumpsCount}  ·  Squats: ${engine.sitStandsCount}`, canvas.width - 20, 50);

        engine.animationId = requestAnimationFrame(runGameLoop);
    };

    // --- INSTANT OPTICAL & CENTROID MOTION ENGINE (ZERO CRASH, <10MS STARTUP) ---

    const handleDetectedJump = useCallback(() => {
        const engine = engineRef.current;
        const tracker = trackerRef.current;

        if (tracker.jumpCooldown > 0 || tracker.squatState === 'SQUATTING') return;
        tracker.jumpCooldown = 0.55;

        setMotionDot(true);
        setTimeout(() => setMotionDot(false), 200);

        if (engine.gameRunning) {
            const jumped = engine.runner.jump();
            if (jumped) {
                engine.jumpsCount += 1;
                triggerRepVisual('+1 JUMP');
                if (!mutedRef.current) SoundSynth.playJump();
            }
        } else if (!engine.gameRunning && engine.canRestart) {
            resetGame();
        } else if (!hasStarted && cameraActive) {
            manualStart();
        }
    }, [hasStarted, cameraActive]);

    const handleSquatRepCompleted = useCallback(() => {
        const engine = engineRef.current;
        engine.sitStandsCount += 1;
        triggerRepVisual('+1 SQUAT');
        if (!mutedRef.current) SoundSynth.playRep();
    }, []);

    const processMotionFrame = useCallback(() => {
        const video = videoRef.current;
        const motionCanvas = motionCanvasRef.current;
        const tracker = trackerRef.current;
        const engine = engineRef.current;

        if (!video || !motionCanvas || video.readyState < 2) {
            tracker.trackingLoopId = requestAnimationFrame(processMotionFrame);
            return;
        }

        const now = performance.now();
        const dt = (now - tracker.lastTime) / 1000;
        tracker.lastTime = now;

        if (tracker.jumpCooldown > 0) {
            tracker.jumpCooldown -= dt;
        }

        const mWidth = motionCanvas.width;
        const mHeight = motionCanvas.height;
        const mCtx = motionCanvas.getContext('2d', { willReadFrequently: true });

        if (!mCtx) {
            tracker.trackingLoopId = requestAnimationFrame(processMotionFrame);
            return;
        }

        // Draw downscaled frame to 64x48 for ultra-fast zero-CPU differential tracking
        mCtx.drawImage(video, 0, 0, mWidth, mHeight);
        const currentData = mCtx.getImageData(0, 0, mWidth, mHeight).data;

        if (tracker.prevFrameData) {
            const prevData = tracker.prevFrameData;
            let totalMotionWeight = 0;
            let motionCenterY = 0;
            let upperMotion = 0;
            let lowerMotion = 0;

            const halfHeight = mHeight / 2;

            // Analyze pixel luminance differences
            for (let y = 0; y < mHeight; y += 2) {
                for (let x = 0; x < mWidth; x += 2) {
                    const idx = (y * mWidth + x) * 4;
                    const diff = Math.abs(currentData[idx] - prevData[idx]) +
                                 Math.abs(currentData[idx + 1] - prevData[idx + 1]) +
                                 Math.abs(currentData[idx + 2] - prevData[idx + 2]);

                    if (diff > 38) { // Significant movement
                        totalMotionWeight += diff;
                        motionCenterY += y * diff;

                        if (y < halfHeight) {
                            upperMotion += diff;
                        } else {
                            lowerMotion += diff;
                        }
                    }
                }
            }

            if (totalMotionWeight > 800) {
                const centroidY = (motionCenterY / totalMotionWeight) / mHeight;
                tracker.currentY = centroidY;

                // Auto-calibrate initial standing baseline
                if (!tracker.isCalibrated) {
                    tracker.baselineY = centroidY;
                    tracker.isCalibrated = true;
                }

                // Vertical velocity
                const dy = tracker.prevCentroidY - centroidY;
                const velocity = dt > 0 ? (dy / dt) : 0;
                tracker.smoothedVelocity = tracker.smoothedVelocity * 0.4 + velocity * 0.6;

                // 1. JUMP DETECTION (Rapid upward centroid velocity)
                if (tracker.smoothedVelocity > 0.42 && tracker.jumpCooldown <= 0 && tracker.squatState === 'STANDING') {
                    handleDetectedJump();
                }

                // 2. SQUAT / SIT-TO-STAND DETECTION (Downward body displacement)
                const squatThreshold = 0.12; // Centroid drops 12% below standing baseline
                const standThreshold = 0.05;

                if (tracker.squatState === 'STANDING') {
                    if (centroidY > tracker.baselineY + squatThreshold && tracker.jumpCooldown <= 0) {
                        tracker.squatState = 'SQUATTING';
                        tracker.squatStartTime = now;
                        engine.runner.duck(true);
                    }
                } else if (tracker.squatState === 'SQUATTING') {
                    // Runner stays ducked while user is in squat position
                    engine.runner.duck(true);

                    // User stands back up to baseline
                    if (centroidY < tracker.baselineY + standThreshold) {
                        const squatDuration = (now - tracker.squatStartTime) / 1000;
                        tracker.squatState = 'STANDING';
                        engine.runner.duck(false);

                        // Valid squat completed
                        if (squatDuration >= 0.25) {
                            handleSquatRepCompleted();
                        }
                    }
                }

                tracker.prevCentroidY = centroidY;
            }
        }

        tracker.prevFrameData = currentData;
        tracker.trackingLoopId = requestAnimationFrame(processMotionFrame);
    }, [handleDetectedJump, handleSquatRepCompleted]);

    // --- CAMERA INITIALIZATION (INSTANT & MOBILE-SAFE) ---

    const initCamera = async () => {
        SoundSynth.init();
        setCameraError('');

        try {
            const stream = preloadedStream || await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320, max: 480 },
                    height: { ideal: 240, max: 360 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setCameraActive(true);
                    if (onStreamReady) onStreamReady(stream);
                    trackerRef.current.trackingLoopId = requestAnimationFrame(processMotionFrame);
                };
            }
        } catch (err: any) {
            console.error('Camera access error:', err);
            setCameraError('Camera access required to track jumps and squats.');
        }
    };

    useEffect(() => {
        if (preloadedStream) {
            initCamera();
        }

        return () => {
            cancelAnimationFrame(trackerRef.current.trackingLoopId);
            cancelAnimationFrame(engineRef.current.animationId);
        };
    }, [preloadedStream]);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className={`w-full flex flex-col items-center select-none font-serif ${
            isFullscreen ? 'fixed inset-0 z-50 bg-[#15191C] p-2 md:p-6 justify-center' : 'max-w-4xl'
        }`}>
            {/* FULLSCREEN CONTROLS BAR (Clean & Minimalist) */}
            {isFullscreen && (
                <div className="w-full max-w-4xl flex items-center justify-between pb-2 text-xs text-hitfit-text border-b border-hitfit-border/40 mb-2">
                    <span className="font-heading font-bold text-hitfit-accent">Workout Mode</span>
                    <button
                        onClick={toggleFullscreen}
                        className="px-3 py-1 bg-hitfit-surface border border-hitfit-border text-hitfit-muted hover:text-hitfit-text rounded-lg cursor-pointer"
                    >
                        Exit Fullscreen
                    </button>
                </div>
            )}

            {/* THE GAME BOX CONTAINER (100% FLUID, RESPONSIVE, ZERO OVERLAPS) */}
            <div className="relative w-full max-w-4xl aspect-[8/3] max-h-[75vh] bg-white rounded-xl overflow-hidden shadow-2xl border border-hitfit-border">
                
                {/* Visual Feedback for Reps */}
                {repVisual && (
                    <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-[#15191C]/90 text-[#F7B83D] text-xs md:text-sm font-heading font-bold rounded-lg border border-[#F7B83D]/40 animate-bounce pointer-events-none shadow-md">
                        {repVisual}
                    </div>
                )}

                {/* Motion Active Indicator Dot */}
                <div
                    className={`absolute top-4 right-4 z-20 w-3 h-3 rounded-full transition-all duration-150 border border-white/60 pointer-events-none ${
                        motionDot ? 'bg-[#F7B83D] scale-125 shadow-[0_0_8px_#F7B83D]' : 'bg-[#535353]/30'
                    }`}
                    title="Camera motion indicator"
                />

                {/* THE CANVAS (CLASSIC #FFFFFF BACKGROUND) */}
                <canvas
                    ref={canvasRef}
                    width={GAME_CONFIG.CANVAS_WIDTH}
                    height={GAME_CONFIG.CANVAS_HEIGHT}
                    className="w-full h-full block object-contain"
                />

                {/* START OVERLAY (LIGHT SURFACE -> DARK TEXT) */}
                {!hasStarted && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 md:p-6 text-center z-10">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-[#15191C] mb-2">
                            Hit the Target to Be Fit
                        </h2>
                        <p className="text-xs sm:text-sm text-[#535353] max-w-md leading-relaxed mb-5">
                            Camera tracks physical workouts on your device. Jump to clear hurdles; squat down to duck beneath flying birds.
                        </p>

                        {!cameraActive ? (
                            <button
                                onClick={initCamera}
                                className="px-6 py-3.5 bg-[#15191C] hover:bg-[#2E363E] text-[#ECEFF2] font-heading font-semibold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer"
                            >
                                Enable Camera & Start
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={manualStart}
                                    className="px-8 py-3.5 bg-[#15191C] hover:bg-[#2E363E] text-[#F7B83D] font-heading font-bold text-xs sm:text-sm rounded-xl shadow-xl transition-all cursor-pointer border border-[#15191C]"
                                >
                                    Start Workout
                                </button>
                                <span className="text-xs text-[#535353] font-semibold animate-pulse">
                                    or Jump to start playing
                                </span>
                            </div>
                        )}

                        {cameraError && (
                            <p className="text-xs text-red-600 mt-3 max-w-xs">{cameraError}</p>
                        )}
                    </div>
                )}

                {/* GAME OVER SCREEN OVERLAY (DARK BACKDROP -> LIGHT TEXT; WHITE CARD -> DARK TEXT) */}
                {hasStarted && !gameRunning && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-white mb-1 drop-shadow">
                            Workout Session Complete
                        </h2>
                        <p className="text-xs font-serif text-[#F7B83D] italic mb-3">
                            Hit the target to be fit.
                        </p>

                        {/* Session Results Card (Light card -> Dark text #15191C) */}
                        <div className="bg-white border border-gray-200 text-[#15191C] p-3.5 sm:p-4 mb-4 text-xs rounded-xl space-y-1.5 shadow-xl max-w-xs sm:max-w-sm w-full">
                            <div className="font-heading font-bold text-base sm:text-lg text-[#15191C]">
                                {hudCalories} Estimated kcal
                            </div>
                            <div className="text-[#535353]">Total Jumps: <strong className="text-[#15191C]">{hudJumps}</strong></div>
                            <div className="text-[#535353]">Squat Reps: <strong className="text-[#15191C]">{hudSitStands}</strong></div>
                            <div className="text-[#535353]">Duration: <strong className="text-[#15191C]">{formatTime(hudActiveSeconds)}</strong></div>
                            {profile.isGenericWeight && (
                                <div className="text-[10px] text-[#777] pt-1 border-t border-gray-200">
                                    Generic 70 kg reference used. Set exact weight in Settings.
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                onClick={resetGame}
                                disabled={!canRestart}
                                className="px-5 py-2.5 bg-[#F7B83D] hover:bg-[#E5A52A] text-[#15191C] font-heading font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
                            >
                                {canRestart ? 'Play Again (or Jump)' : 'Saving Session...'}
                            </button>

                            {onOpenProgress && (
                                <button
                                    onClick={onOpenProgress}
                                    className="px-4 py-2.5 bg-white hover:bg-gray-100 text-[#15191C] font-heading font-semibold text-xs rounded-xl transition-colors cursor-pointer border border-white"
                                >
                                    View Today's Progress
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* STATUS & ACTIONS BAR BELOW CANVAS (CLEAN & MINIMALIST) */}
            <div className="w-full flex items-center justify-between text-xs text-hitfit-muted pt-3 px-1 gap-2 flex-wrap">
                <span className="truncate">
                    {cameraActive
                        ? 'Camera active · Jump over hurdles · Squat beneath birds'
                        : 'Stand back so your upper body is clearly visible'}
                </span>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="text-xs text-hitfit-text hover:text-hitfit-accent transition-colors underline cursor-pointer"
                    >
                        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Workout'}
                    </button>
                </div>
            </div>

            {/* OFF-SCREEN HARDWARE-ACCELERATED VIDEO & MOTION CANVASES (NO UI CLUTTER) */}
            <div className="hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    width="320"
                    height="240"
                />
                <canvas
                    ref={motionCanvasRef}
                    width="64"
                    height="48"
                />
            </div>
        </div>
    );
};

export default DinoGame;