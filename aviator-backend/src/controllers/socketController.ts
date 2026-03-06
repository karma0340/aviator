import { Server, Socket } from 'socket.io';
import User, { IUser } from '../models/User';
import FlyDetail from '../models/FlyDetail';
import GameBet from '../models/GameBet';
import { gameEngine, ActiveBet } from './gameController';
import { v4 as uuidv4 } from 'uuid';

// In-memory map: socketId → user data
const connectedUsers = new Map<string, IUser & { userId: string }>();

export const initSocketController = (io: Server) => {

    // ── Game Engine Callbacks ──────────────────────────────────────────

    /** Broadcast game state to ALL clients every tick */
    gameEngine.onStateUpdate = (gameState) => {
        io.emit('gameState', gameState);
    };

    /** Called when a round ends (plane crashed) */
    gameEngine.onRoundEnd = async (crashPoint: number, bets: ActiveBet[]) => {
        try {
            // Save round to DB
            const flyDetailID = gameEngine.state.roundId - 1;
            await FlyDetail.create({
                flyDetailID,
                flyAway: crashPoint,
                serverSeed: gameEngine.state.serverSeed,
                serverSeedHash: gameEngine.state.serverSeedHash,
                seedOfUsers: [],
                bets: bets.map(b => ({
                    userId: b.userId,
                    userName: b.userName,
                    avatar: b.avatar,
                    betAmount: b.betAmount,
                    cashAmount: b.cashAmount,
                    cashouted: b.cashouted,
                    cashoutAt: b.cashoutAt,
                    type: b.type,
                    betid: b.betid,
                })),
            });

            // Process each bet — update user balances, save GameBet record
            for (const bet of bets) {
                try {
                    // Save individual bet record for "my bets" history
                    await GameBet.create({
                        userId: bet.userId,
                        userName: bet.userName,
                        betAmount: bet.betAmount,
                        cashoutAt: bet.cashouted ? bet.cashoutAt : 0,
                        cashouted: bet.cashouted,
                        flyAway: crashPoint,
                        flyDetailID,
                    });

                    // If the user did NOT cash out, they lost — balance already deducted when bet placed
                    // If they DID cash out, we don't add balance here because it's already done
                    // immediately upon cashout (manual or auto) to provide instant feedback.

                    // Send finish event to this socket
                    const socket = io.sockets.sockets.get(bet.socketId);
                    if (socket) {
                        const user = await User.findById(bet.userId);
                        if (user) {
                            const userPayload = buildUserPayload(user, bet, bets);
                            socket.emit('finishGame', userPayload);
                        }
                    }
                } catch (err) {
                    console.error('Error processing bet on round end:', err);
                }
            }

            // Send finishGame to non-betting sockets too (so their state resets)
            connectedUsers.forEach(async (userData, socketId) => {
                const hasBet = bets.some(b => b.socketId === socketId);
                if (!hasBet) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        const user = await User.findById(userData._id);
                        if (user) {
                            socket.emit('finishGame', buildEmptyUserPayload(user, socketId));
                        }
                    }
                }
            });

            // Broadcast previous hand & updated history
            const previousHand = bets.map(b => buildBetUserForPreviousHand(b, crashPoint));
            io.emit('previousHand', previousHand);
            io.emit('history', gameEngine.history);

        } catch (err) {
            console.error('🔴 Error in onRoundEnd:', err);
        }
    };

    /** When a bet is placed, broadcast updated betted users list */
    gameEngine.onBetPlaced = () => {
        io.emit('bettedUserInfo', gameEngine.getBettedUsers());
    };

    /** When a round starts, clear current bets list for everyone */
    gameEngine.onRoundStart = () => {
        io.emit('bettedUserInfo', []);
    };

    /** Auto cashout processed by game engine — inform that socket */
    gameEngine.onAutoCashout = async (bet: ActiveBet) => {
        try {
            // Add winnings immediately
            await User.findByIdAndUpdate(bet.userId, { $inc: { balance: bet.cashAmount } });
            const socket = io.sockets.sockets.get(bet.socketId);
            if (socket) {
                const user = await User.findById(bet.userId);
                if (user) {
                    socket.emit('success', `Cashed out at ${bet.cashoutAt}x! Won ${bet.cashAmount.toFixed(2)} INR`);
                    socket.emit('myInfo', {
                        ...buildEmptyUserPayload(user, socket.id),
                    });
                }
            }
            // Refresh betted users list
            io.emit('bettedUserInfo', gameEngine.getBettedUsers());
        } catch (err) {
            console.error('Error in auto cashout:', err);
        }
    };

    // ── Socket Connection Handler ──────────────────────────────────────

    io.on('connection', (socket: Socket) => {
        console.log(`✅ Socket connected: ${socket.id}`);

        // ── enterRoom ─────────────────────────────────────────────────────
        socket.on('enterRoom', async ({ token }: { token: string }) => {
            try {
                if (!token || token.trim() === "" || token === "null" || token === "undefined") {
                    socket.emit('error', { message: 'Session expired or invalid token. Please refresh the page.' });
                    return;
                }

                // Find or create user based on token
                let user = await User.findOne({ token });
                if (!user) {
                    // Auto-create demo user using token as both name and token
                    const userName = `Player_${token.slice(0, 8)}`;
                    user = await User.create({
                        userName,
                        token,
                        balance: parseFloat(process.env.STARTING_BALANCE || '1000'),
                        currency: 'INR',
                    });
                    console.log(`🆕 Created new user: ${userName}`);
                }

                connectedUsers.set(socket.id, user as any);

                // Send initial data to this client
                socket.emit('myInfo', buildEmptyUserPayload(user, socket.id));
                socket.emit('history', gameEngine.history);
                socket.emit('bettedUserInfo', gameEngine.getBettedUsers());
                socket.emit('getBetLimits', {
                    min: parseFloat(process.env.MIN_BET || '1'),
                    max: parseFloat(process.env.MAX_BET || '1000'),
                });
                socket.emit('previousHand', gameEngine.previousHand);
                socket.emit('myBetState', buildEmptyUserPayload(user, socket.id));

                console.log(`👤 User entered room: ${user.userName}`);
            } catch (err) {
                console.error('❌ enterRoom error:', err);
                socket.emit('error', { message: 'Server error on login' });
            }
        });

        // ── playBet ───────────────────────────────────────────────────────
        socket.on('playBet', async (data: {
            betAmount: number;
            target: number;
            type: 'f' | 's';
            auto: boolean;
        }) => {
            try {
                const userData = connectedUsers.get(socket.id);
                if (!userData) {
                    socket.emit('error', { message: 'Not authenticated', index: data.type });
                    return;
                }

                const user = await User.findById(userData._id);
                if (!user) {
                    socket.emit('error', { message: 'User not found', index: data.type });
                    return;
                }

                const betAmount = Math.round(data.betAmount * 100) / 100;
                const minBet = parseFloat(process.env.MIN_BET || '1');
                const maxBet = parseFloat(process.env.MAX_BET || '1000');

                if (betAmount < minBet || betAmount > maxBet) {
                    socket.emit('error', { message: `Bet must be between ${minBet} and ${maxBet}`, index: data.type });
                    return;
                }

                if (user.balance < betAmount) {
                    socket.emit('recharge');
                    return;
                }

                const result = gameEngine.placeBet(
                    socket.id,
                    user._id.toString(),
                    user.userName,
                    user.avatar,
                    { betAmount, target: data.target, type: data.type, auto: data.auto }
                );

                if (!result.success) {
                    socket.emit('error', { message: result.error, index: data.type });
                    return;
                }

                // Deduct bet from balance
                user.balance = Math.round((user.balance - betAmount) * 100) / 100;
                await user.save();

                // Send updated state back
                socket.emit('myBetState', buildEmptyUserPayload(user, socket.id));
                socket.emit('myInfo', buildEmptyUserPayload(user, socket.id));

                // Broadcast updated betted users
                io.emit('bettedUserInfo', gameEngine.getBettedUsers());

                console.log(`💰 Bet placed: ${user.userName} → ${betAmount} INR [${data.type}]`);
            } catch (err) {
                console.error('❌ playBet error:', err);
                socket.emit('error', { message: 'Error placing bet', index: data.type });
            }
        });

        // ── cashOut ───────────────────────────────────────────────────────
        socket.on('cashOut', async (data: { type: 'f' | 's'; endTarget: number }) => {
            try {
                const userData = connectedUsers.get(socket.id);
                if (!userData) {
                    socket.emit('error', { message: 'Not authenticated', index: data.type });
                    return;
                }

                const result = gameEngine.processCashout(socket.id, data.type, data.endTarget);
                if (!result.success) {
                    socket.emit('error', { message: result.error, index: data.type });
                    return;
                }

                const cashAmount = result.cashAmount!;
                const user = await User.findByIdAndUpdate(
                    userData._id,
                    { $inc: { balance: cashAmount } },
                    { new: true }
                );

                if (user) {
                    socket.emit('success', `Cashed out! Won ${cashAmount.toFixed(2)} INR`);
                    socket.emit('myInfo', buildEmptyUserPayload(user, socket.id));
                    io.emit('bettedUserInfo', gameEngine.getBettedUsers());
                    console.log(`💸 Cashout: ${user.userName} → ${cashAmount.toFixed(2)} INR`);
                }
            } catch (err) {
                console.error('❌ cashOut error:', err);
                socket.emit('error', { message: 'Error cashing out', index: data.type });
            }
        });

        // ── disconnect ────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                console.log(`👋 User disconnected: ${userData.userName}`);
                connectedUsers.delete(socket.id);
            }
        });
    });
};

// ── Helper functions ─────────────────────────────────────────────────

function buildEmptyUserPayload(user: IUser, socketId?: string) {
    const fBet = socketId ? gameEngine.activeBets.get(`${socketId}_f`) : null;
    const sBet = socketId ? gameEngine.activeBets.get(`${socketId}_s`) : null;

    return {
        balance: user.balance,
        userType: user.userType,
        avatar: user.avatar,
        userId: user._id?.toString() || '',
        currency: user.currency,
        userName: user.userName,
        ipAddress: user.ipAddress,
        platform: user.platform,
        token: user.token,
        Session_Token: user.token,
        isSoundEnable: user.isSoundEnable,
        isMusicEnable: user.isMusicEnable,
        msgVisible: user.msgVisible,
        f: {
            auto: fBet?.auto || false,
            autocashout: false,
            betid: fBet?.betid || '0',
            betted: !!fBet && !fBet.cashouted,
            cashouted: fBet?.cashouted || false,
            cashAmount: fBet?.cashAmount || 0,
            betAmount: fBet?.betAmount || 20,
            target: fBet?.target || 2,
        },
        s: {
            auto: sBet?.auto || false,
            autocashout: false,
            betid: sBet?.betid || '0',
            betted: !!sBet && !sBet.cashouted,
            cashouted: sBet?.cashouted || false,
            cashAmount: sBet?.cashAmount || 0,
            betAmount: sBet?.betAmount || 20,
            target: sBet?.target || 2,
        },
    };
}

function buildUserPayload(user: IUser, bet: ActiveBet, allBets: ActiveBet[]) {
    const fBet = allBets.find(b => b.socketId === bet.socketId && b.type === 'f');
    const sBet = allBets.find(b => b.socketId === bet.socketId && b.type === 's');
    return {
        ...buildEmptyUserPayload(user),
        f: fBet ? {
            auto: fBet.auto, autocashout: false, betid: fBet.betid,
            betted: false, cashouted: fBet.cashouted,
            cashAmount: fBet.cashAmount, betAmount: fBet.betAmount, target: fBet.target,
        } : buildEmptyUserPayload(user).f,
        s: sBet ? {
            auto: sBet.auto, autocashout: false, betid: sBet.betid,
            betted: false, cashouted: sBet.cashouted,
            cashAmount: sBet.cashAmount, betAmount: sBet.betAmount, target: sBet.target,
        } : buildEmptyUserPayload(user).s,
    };
}

function buildBetUserForPreviousHand(bet: ActiveBet, crashPoint: number) {
    return {
        name: bet.userName,
        avatar: bet.avatar,
        betAmount: bet.betAmount,
        cashAmount: bet.cashouted ? bet.cashAmount : 0,
        cashouted: bet.cashouted,
        cashoutAt: bet.cashoutAt,
        flyAway: crashPoint,
    };
}

export { connectedUsers };
