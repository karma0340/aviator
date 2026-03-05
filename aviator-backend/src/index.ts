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

// ── MongoDB → Socket.IO → Game Engine ────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aviator';

async function bootstrap() {
    try {
        console.log(`⏳ Connecting to MongoDB: ${MONGO_URI}`);
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB connected');

        // Init socket handlers
        initSocketController(io);
        console.log('✅ Socket.IO initialized');

        // Fetch highest flyDetailID to avoid E11000 duplicate keys
        const latestFlyDetail = await FlyDetail.findOne().sort({ flyDetailID: -1 });
        let nextRoundId = 1;
        if (latestFlyDetail) {
            nextRoundId = latestFlyDetail.flyDetailID + 2; // Since flyDetailID = roundId - 1
        }

        // Start game engine
        gameEngine.start(nextRoundId);
        console.log(`✅ Game engine started at round ID: ${nextRoundId}`);

        // Start HTTP server
        server.listen(PORT, () => {
            console.log('');
            console.log('====================================================');
            console.log(`  🛩️  Aviator Backend running on port ${PORT}`);
            console.log('====================================================');
            console.log(`  🌐 Health:    http://localhost:${PORT}/`);
            console.log(`  🔌 Socket:    ws://localhost:${PORT}`);
            console.log(`  📦 API:       http://localhost:${PORT}/api`);
            console.log('');
            console.log('  ▶️  To play:');
            console.log(`     Open http://localhost:3000/?cert=YOUR_NAME`);
            console.log('====================================================');
            console.log('');
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    gameEngine.stop();
    mongoose.disconnect();
    process.exit(0);
});

bootstrap();
