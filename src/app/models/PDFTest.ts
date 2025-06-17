import mongoose from 'mongoose';

const PDFSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
}, { _id: false }); // prevents automatic _id generation for subdocs

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    validate: (v: string | any[]) => Array.isArray(v) && v.length >= 2,
  },
  correctAnswer: {
    type: String,
    required: true,
  },
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
}, { _id: false });

const pdfTestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contextPDFs: {
    type: [PDFSchema],
    default: [],
  },
  pyqPDF: {
    type: [PDFSchema],
    required: true,
  },
  questions: {
    type: [QuestionSchema],
    default: [],
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  timeLimit: {
    type: Number,
    default: 60 // Default time limit in minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // replaces manual createdAt & updatedAt
});

const PDFTest = mongoose.models.PDFTest || mongoose.model('PDFTest', pdfTestSchema);
export default PDFTest;
