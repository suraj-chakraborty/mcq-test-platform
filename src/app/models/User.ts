import mongoose from 'mongoose';
import { Schema, models, model } from 'mongoose';

export interface IUser {
  name: string;
  email: string;
  password: string;
  uploadedPdfs: mongoose.Types.ObjectId[];
  testHistory: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  image: string;
  mongodbUrl: string;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  uploadedPdfs: [{
    type: Schema.Types.ObjectId,
    ref: 'Pdf',
  }],
  testHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'TestResult',
  }],
  image: {
    type: String,
  },
  mongodbUrl: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const User = models.User || model<IUser>('User', userSchema);

export default User; 