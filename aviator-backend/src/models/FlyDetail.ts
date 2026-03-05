import mongoose, { Document, Schema } from 'mongoose';

export interface IBet {
    userId: string;
    userName: string;
    avatar: string;
    betAmount: number;
    cashAmount: number;
    cashouted: boolean;
    cashoutAt: number;
    type: 'f' | 's';
    betid: string;
}

export interface IFlyDetail extends Document {
    flyDetailID: number;
    flyAway: number;
    serverSeed: string;
    serverSeedHash: string;
    seedOfUsers: Array<{ seed: string; userId: string }>;
    bets: IBet[];
    createdAt: Date;
}

const BetSchema = new Schema<IBet>({
    userId: String,
    userName: String,
    avatar: String,
    betAmount: Number,
    cashAmount: { type: Number, default: 0 },
    cashouted: { type: Boolean, default: false },
    cashoutAt: { type: Number, default: 0 },
    type: String,
    betid: String,
});

const FlyDetailSchema = new Schema<IFlyDetail>({
    flyDetailID: { type: Number, unique: true },
    flyAway: { type: Number, required: true },
    serverSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    seedOfUsers: [{ seed: String, userId: String }],
    bets: [BetSchema],
}, { timestamps: true });

export default mongoose.model<IFlyDetail>('FlyDetail', FlyDetailSchema);
