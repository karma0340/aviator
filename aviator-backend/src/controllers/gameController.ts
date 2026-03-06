import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export type GamePhase = 'BET' | 'PLAYING' | 'CRASHED';

export interface ActiveBet {
    socketId: string;
    userId: string;
    userName: string;
    avatar: string;
    betAmount: number;
    target: number;
    type: 'f' | 's';
    betid: string;
    auto: boolean;
    cashouted: boolean;
    cashAmount: number;
    cashoutAt: number;
}

export interface GameState {
    phase: GamePhase;
    currentMultiplier: number;
    crashPoint: number;
    roundId: number;
    serverSeed: string;
    serverSeedHash: string;
    startTime: number | null;
}

class GameEngine {
    public state: GameState;
    public activeBets: Map<string, ActiveBet> = new Map(); // key: socketId+type
    public history: number[] = [];
    private ticker: NodeJS.Timeout | null = null;
    private phaseTimer: NodeJS.Timeout | null = null;

    // Callbacks set by socketController
    public onStateUpdate: ((gameState: any) => void) | null = null;
    public onRoundEnd: ((crashPoint: number, bets: ActiveBet[]) => void) | null = null;
    public onBetPlaced: (() => void) | null = null;
    public onRoundStart: (() => void) | null = null;
    public onPlayingPhaseStart: ((bets: ActiveBet[]) => void) | null = null;
    public onAutoCashout: ((bet: ActiveBet) => void) | null = null;
    public previousHand: any[] = [];

    constructor() {
        this.state = this.createInitialState();
    }

    private createInitialState(): GameState {
        const serverSeed = uuidv4().replace(/-/g, '');
        return {
            phase: 'BET',
            currentMultiplier: 1.00,
            crashPoint: this.generateCrashPoint(serverSeed),
            roundId: 1,
            serverSeed,
            serverSeedHash: this.hashSeed(serverSeed),
            startTime: null,
        };
    }

    /** Generate crash point using provably fair HMAC-SHA256 algorithm */
    public generateCrashPoint(seed: string): number {
        const hash = crypto.createHmac('sha256', seed).update('crash').digest('hex');
        const h = parseInt(hash.slice(0, 8), 16);
        const e = Math.pow(2, 32);
        // House edge ~3%
        if (h % 33 === 0) return 1.00; // instant crash (house edge)
        const crashPoint = Math.floor((100 * e - h) / (e - h)) / 100;
        return Math.max(1.00, crashPoint);
    }

    public hashSeed(seed: string): string {
        return crypto.createHash('sha256').update(seed).digest('hex');
    }

    public start(initialRoundId: number = 1) {
        console.log('🎮 Game engine starting...');
        if (initialRoundId > 1) {
            this.state.roundId = initialRoundId;
        }
        this.runBetPhase();
    }

    private runBetPhase() {
        this.state.phase = 'BET';
        this.state.currentMultiplier = 1.00;
        this.state.startTime = Date.now();

        // Broadcast BET state every 500ms
        this.broadcastState();
        if (this.onRoundStart) this.onRoundStart();

        const betDuration = parseInt(process.env.BET_PHASE_DURATION || '5000');
        this.phaseTimer = setTimeout(() => {
            this.runPlayingPhase();
        }, betDuration);
    }

    private runPlayingPhase() {
        this.state.phase = 'PLAYING';
        this.state.startTime = Date.now();
        this.state.currentMultiplier = 1.00;

        const tickInterval = 100; // ms per tick
        this.ticker = setInterval(() => {
            const elapsed = Date.now() - (this.state.startTime || Date.now());
            // Multiplier grows exponentially: 1 * e^(0.00006 * elapsed)
            this.state.currentMultiplier = Math.floor(100 * Math.pow(Math.E, 0.00006 * elapsed)) / 100;

            // Check auto cashouts
            this.activeBets.forEach((bet) => {
                if (!bet.cashouted && bet.target > 0 && this.state.currentMultiplier >= bet.target) {
                    this.processCashout(bet.socketId, bet.type, bet.target);
                }
            });

            // Check if we've hit the crash point
            if (this.state.currentMultiplier >= this.state.crashPoint) {
                this.state.currentMultiplier = this.state.crashPoint;
                this.broadcastState();
                clearInterval(this.ticker!);
                this.runCrashedPhase();
            } else {
                this.broadcastState();
            }
        }, tickInterval);
    }

    private runCrashedPhase() {
        this.state.phase = 'CRASHED';
        this.broadcastState();

        const crashedBets = Array.from(this.activeBets.values());

        // Push to history
        this.history.unshift(this.state.crashPoint);
        if (this.history.length > 20) this.history.pop();

        // Notify round end
        if (this.onRoundEnd) {
            this.onRoundEnd(this.state.crashPoint, crashedBets);
        }

        const crashedDuration = parseInt(process.env.CRASHED_PHASE_DURATION || '2000');
        this.phaseTimer = setTimeout(() => {
            this.nextRound();
        }, crashedDuration);
    }

    private nextRound() {
        // Store previous hand
        this.previousHand = this.getBettedUsers();

        // Clear bets
        this.activeBets.clear();

        // Generate new round params
        const serverSeed = uuidv4().replace(/-/g, '');
        this.state = {
            phase: 'BET',
            currentMultiplier: 1.00,
            crashPoint: this.generateCrashPoint(serverSeed),
            roundId: this.state.roundId + 1,
            serverSeed,
            serverSeedHash: this.hashSeed(serverSeed),
            startTime: null,
        };

        this.runBetPhase();
    }

    public placeBet(socketId: string, userId: string, userName: string, avatar: string, data: {
        betAmount: number;
        target: number;
        type: 'f' | 's';
        auto: boolean;
    }): { success: boolean; error?: string } {
        if (this.state.phase !== 'BET') {
            return { success: false, error: 'Betting phase is over' };
        }

        const key = `${socketId}_${data.type}`;
        if (this.activeBets.has(key)) {
            return { success: false, error: 'Bet already placed' };
        }

        const bet: ActiveBet = {
            socketId,
            userId,
            userName,
            avatar,
            betAmount: data.betAmount,
            target: data.target,
            type: data.type,
            betid: uuidv4(),
            auto: data.auto,
            cashouted: false,
            cashAmount: 0,
            cashoutAt: 0,
        };

        this.activeBets.set(key, bet);
        if (this.onBetPlaced) this.onBetPlaced();

        return { success: true };
    }

    public cancelBet(socketId: string, type: 'f' | 's'): { success: boolean; error?: string; betAmount?: number } {
        if (this.state.phase !== 'BET') {
            return { success: false, error: 'Cannot cancel. Betting phase is over.' };
        }

        const key = `${socketId}_${type}`;
        const bet = this.activeBets.get(key);
        if (!bet) {
            return { success: false, error: 'Bet not found to cancel' };
        }

        const betAmount = bet.betAmount;
        this.activeBets.delete(key);
        // We can emit onBetPlaced again to refresh the betted users list
        if (this.onBetPlaced) this.onBetPlaced();

        return { success: true, betAmount };
    }

    public processCashout(socketId: string, type: 'f' | 's', endTarget?: number): { success: boolean; cashAmount?: number; error?: string } {
        if (this.state.phase !== 'PLAYING') {
            return { success: false, error: 'Not in playing phase' };
        }

        const key = `${socketId}_${type}`;
        const bet = this.activeBets.get(key);

        if (!bet) return { success: false, error: 'Bet not found' };
        if (bet.cashouted) return { success: false, error: 'Already cashed out' };

        const cashoutMultiplier = Math.min(
            endTarget || this.state.currentMultiplier,
            this.state.currentMultiplier
        );

        const cashAmount = Math.floor(bet.betAmount * cashoutMultiplier * 100) / 100;
        bet.cashouted = true;
        bet.cashAmount = cashAmount;
        bet.cashoutAt = cashoutMultiplier;

        this.activeBets.set(key, bet);

        if (this.onAutoCashout) this.onAutoCashout(bet);

        return { success: true, cashAmount };
    }

    private broadcastState() {
        if (this.onStateUpdate) {
            this.onStateUpdate({
                GameState: this.state.phase,
                currentNum: this.state.currentMultiplier.toFixed(2),
                currentSecondNum: this.state.currentMultiplier,
                time: this.state.startTime ? this.state.startTime : 0,
            });
        }
    }

    public getBettedUsers(): any[] {
        return Array.from(this.activeBets.values()).map(bet => ({
            name: bet.userName,
            betAmount: bet.betAmount,
            cashOut: bet.cashAmount,
            cashouted: bet.cashouted,
            target: bet.cashouted ? bet.cashoutAt : bet.target,
            img: bet.avatar,
        }));
    }

    public stop() {
        if (this.ticker) clearInterval(this.ticker);
        if (this.phaseTimer) clearTimeout(this.phaseTimer);
    }
}

export const gameEngine = new GameEngine();
