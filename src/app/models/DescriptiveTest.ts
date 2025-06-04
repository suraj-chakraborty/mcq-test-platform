import mongoose from 'mongoose';

const descriptiveTestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  examName: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  wordCount: {
    type: Number,
    required: true,
  },
  timeLimit: {
    type: Number, // in minutes
    required: true,
  },
  timeTaken: {
    type: Number, // in seconds
    required: true,
  },
  feedback: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  suggestions: [{
    type: String,
  }],
  strengths: [{
    type: String,
  }],
  areasToImprove: [{
    type: String,
  }],
}, {
  timestamps: true,
});

const DescriptiveTest = mongoose.models.DescriptiveTest || mongoose.model('DescriptiveTest', descriptiveTestSchema);

export default DescriptiveTest; 