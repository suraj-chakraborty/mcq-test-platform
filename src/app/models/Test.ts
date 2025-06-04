import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  questions: [{
    question: {
      type: String,
      required: true,
    },
    options: [{
      type: String,
      required: true,
    }
  ],
    correctAnswer: {
      type: Number,
      required: true,
    },
  }],
  totalMarks: {
    type: Number,
    required: true,
    default: 100,
  },
  passingMarks: {
    type: Number,
    required: true,
    default: 50,
  },
  duration: {
    type: Number,
    required: true,
    default: 30, // in minutes
  },
}, {
  timestamps: true,
  collection: 'Test'
});

export default mongoose.models.Test || mongoose.model('Test', testSchema);