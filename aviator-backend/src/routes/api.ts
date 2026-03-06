import { Router, Request, Response } from 'express';
import GameBet from '../models/GameBet';
import FlyDetail from '../models/FlyDetail';
import User from '../models/User';
import Message from '../models/Message';

const router = Router();

/**
 * GET /api
 * Simple health check for the API mount point
 */
router.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Aviator API is running' });
});

/**
 * POST /api/my-info
 * Returns a user's personal bet history
 * Body: { name: string }
 */
router.post('/my-info', async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ status: false, message: 'Name is required' });
        }

        const bets = await GameBet.find({ userName: name })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const formatted = bets.map((bet, index) => ({
            _id: index + 1,
            name: bet.userName,
            betAmount: bet.betAmount,
            cashoutAt: bet.cashoutAt,
            cashouted: bet.cashouted,
            createdAt: bet.createdAt,
            flyAway: bet.flyAway,
            flyDetailID: bet.flyDetailID,
        }));

        return res.json({ status: true, data: formatted });
    } catch (err) {
        console.error('my-info error:', err);
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * GET /api/game/seed/:id
 * Returns seed details for provably fair verification of a round
 */
router.get('/game/seed/:id', async (req: Request, res: Response) => {
    try {
        const flyDetailID = parseInt(req.params.id);
        const round = await FlyDetail.findOne({ flyDetailID }).lean();

        if (!round) {
            return res.status(404).json({ message: 'Round not found' });
        }

        return res.json({
            flyDetailID: round.flyDetailID,
            serverSeed: round.serverSeed,
            serverSeedHash: round.serverSeedHash,
            seedOfUsers: round.seedOfUsers || [],
            createdAt: round.createdAt,
        });
    } catch (err) {
        console.error('game/seed error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/history
 * Returns the last 50 round crash points
 */
router.get('/history', async (_req: Request, res: Response) => {
    try {
        const rounds = await FlyDetail.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .select('flyAway flyDetailID createdAt')
            .lean();
        return res.json(rounds);
    } catch (err) {
        return res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/get-day-history
 * Returns the top 50 wins of the day
 */
router.get('/get-day-history', async (_req: Request, res: Response) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const bets = await GameBet.find({
            createdAt: { $gte: startOfDay },
            cashouted: true
        })
            .sort({ cashoutAt: -1 }) // Sort by highest multiplier
            .limit(50)
            .lean();

        return res.json({ status: true, data: bets });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * GET /api/get-month-history
 * Returns the top 50 wins of the month
 */
router.get('/get-month-history', async (_req: Request, res: Response) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const bets = await GameBet.find({
            createdAt: { $gte: startOfMonth },
            cashouted: true
        })
            .sort({ cashoutAt: -1 })
            .limit(50)
            .lean();

        return res.json({ status: true, data: bets });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * GET /api/get-year-history
 * Returns the top 50 wins of the year
 */
router.get('/get-year-history', async (_req: Request, res: Response) => {
    try {
        const startOfYear = new Date();
        startOfYear.setMonth(0, 1);
        startOfYear.setHours(0, 0, 0, 0);

        const bets = await GameBet.find({
            createdAt: { $gte: startOfYear },
            cashouted: true
        })
            .sort({ cashoutAt: -1 })
            .limit(50)
            .lean();

        return res.json({ status: true, data: bets });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * POST /api/get-all-chat
 */
router.post('/get-all-chat', async (_req, res) => {
    try {
        const chats = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
        return res.json({ status: true, data: chats.reverse() });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * POST /api/like-chat
 */
router.post('/like-chat', async (req, res) => {
    try {
        const { chatID, userId } = req.body;
        const chat = await Message.findById(chatID);
        if (chat) {
            if (!chat.likesIDs.includes(userId)) {
                chat.likesIDs.push(userId);
                await chat.save();
            }
        }
        return res.json({ status: true });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

/**
 * POST /api/update-info
 */
router.post('/update-info', async (req, res) => {
    try {
        const { userId, updateData } = req.body;
        await User.findOneAndUpdate({ userId }, updateData, { upsert: true });
        return res.json({ status: true });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Server error' });
    }
});

export default router;
