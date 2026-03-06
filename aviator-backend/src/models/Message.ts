import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    userName: string;
    avatar: string;
    message: string;
    likesIDs: string[];
    createdAt: Date;
}

const MessageSchema: Schema = new Schema({
    userName: { type: String, required: true },
    avatar: { type: String, default: '' },
    message: { type: String, required: true },
    likesIDs: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
