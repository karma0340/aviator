console.log('🚀 SERVER STARTING...');
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import apiRoutes from './routes/api';
import { initSocketController } from './controllers/socketController';
import { gameEngine } from './controllers/gameController';
import FlyDetail from './models/FlyDetail';

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Socket.IO ────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
});

// ── REST API Routes ──────────────────────────────────────────────────
app.use('/api', apiRoutes);

// Health check
app.get('/', (_req, res) => {
    res.json({
        status: 'running',
        game: gameEngine.state.phase,
        multiplier: gameEngine.state.currentMultiplier,
        roundId: gameEngine.state.roundId,
        activeBets: gameEngine.activeBets.size,
        history: gameEngine.history.slice(0, 5),
    });
});

// ── Export for Vercel ──────────────────────────────────────────────────
export default app;

// ── Startup logic ───────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aviator';

async function bootstrap() {
    try {
        console.log(`⏳ Connecting to MongoDB...`);
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGO_URI);
            console.log('✅ MongoDB connected');
        }

        // Init socket handlers
        initSocketController(io);
        console.log('✅ Socket.IO initialized');

        // Fetch highest flyDetailID
        const latestFlyDetail = await FlyDetail.findOne().sort({ flyDetailID: -1 });
        let nextRoundId = 1;
        if (latestFlyDetail) {
            nextRoundId = latestFlyDetail.flyDetailID + 2;
        }

        // Start game engine
        gameEngine.start(nextRoundId);
        console.log(`✅ Game engine started: Round ${nextRoundId}`);

        // Start listening
        if (!process.env.VERCEL) {
            const PORT = process.env.PORT || 10000; // Render default
            server.listen(PORT, '0.0.0.0', () => {
                console.log('====================================================');
                console.log(`  🛩️  Aviator Backend is LIVE on port ${PORT}`);
                console.log('====================================================');
            });
        }
    } catch (err) {
        console.error('❌ CRITICAL STARTUP ERROR:', err);
        process.exit(1);
    }
}

// Trigger bootstrap
bootstrap();
