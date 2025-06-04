import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },

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
  
}, {
  timestamps: true,
  collection: 'Question'
});

export default mongoose.models.Question || mongoose.model('Question', questionSchema);