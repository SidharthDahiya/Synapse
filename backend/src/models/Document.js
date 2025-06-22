import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true
  },
  originalName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  chunks: [{
    text: {
      type: String,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  }],
  fileType: {
    type: String,
    required: true,
    enum: ['.pdf', '.txt', '.docx']
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  }
}, {
  timestamps: true
});

// Index for faster queries
documentSchema.index({ uploadedAt: -1 });
documentSchema.index({ status: 1 });

export default mongoose.model('Document', documentSchema);
