import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    userName: string;
    token: string;
    balance: number;
    currency: string;
    avatar: string;
    userType: boolean;
    ipAddress: string;
    platform: string;
    isSoundEnable: boolean;
    isMusicEnable: boolean;
    msgVisible: boolean;
}

const UserSchema = new Schema<IUser>({
    userName: { type: String, required: true, unique: true },
    token: { type: String, required: true, unique: true },
    balance: { type: Number, default: 10000 },
    currency: { type: String, default: 'INR' },
    avatar: { type: String, default: '' },
    userType: { type: Boolean, default: false },
    ipAddress: { type: String, default: '' },
    platform: { type: String, default: 'desktop' },
    isSoundEnable: { type: Boolean, default: false },
    isMusicEnable: { type: Boolean, default: false },
    msgVisible: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
