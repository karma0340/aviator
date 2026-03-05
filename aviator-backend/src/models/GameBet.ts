import mongoose, { Document, Schema } from 'mongoose';

export interface IGameBet extends Document {
    userId: string;
    userName: string;
    betAmount: number;
    cashoutAt: number;
    cashouted: boolean;
    flyAway: number;
    flyDetailID: number;
    createdAt: Date;
}

const GameBetSchema = new Schema<IGameBet>({
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    betAmount: { type: Number, required: true },
    cashoutAt: { type: Number, default: 0 },
    cashouted: { type: Boolean, default: false },
    flyAway: { type: Number, default: 0 },
    flyDetailID: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model<IGameBet>('GameBet', GameBetSchema);
