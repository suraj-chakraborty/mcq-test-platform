import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },
  questions: [{
    question: {
      type: String,
      // required: true,
    },
    options: [{
      type: String,
      // required: true,
    }
  ],
    correctAnswer: {
      type: Number,
      // required: true,
    },
  }],
  answers: [Number],
  score: {
    type: Number,
    required: true,
  },
  passed: {
    type: Boolean,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  correctAnswers: {
    type: Number,
    required: true,
  },
  wrongAnswers: {
    type: Number,
    required: true,
  },
  timeTaken: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

export default mongoose.models.TestResult || mongoose.model('TestResult', testResultSchema); 