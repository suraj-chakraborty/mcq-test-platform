import mongoose from 'mongoose';
import { Schema, models, model } from 'mongoose';

export interface IPdf {
  title: string;
  content: string;
  url: string;
  isReference: boolean;
  userId: mongoose.Types.ObjectId;
  fileSize: number;
  pageCount: number;
  createdAt: Date;
  updatedAt: Date;
  mcqs: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }[];
}

const mcqSchema = new Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  correctAnswer: {
    type: Number,
    required: true,
  },
  explanation: {
    type: String,
    required: true,
  },
});

const pdfSchema = new Schema<IPdf>({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  isReference: {
    type: Boolean,
    default: false,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  pageCount: {
    type: Number,
    required: true,
  },
  mcqs: [mcqSchema],
}, {
  timestamps: true,
});

const Pdf = models.Pdf || model<IPdf>('Pdf', pdfSchema);

export default Pdf; 