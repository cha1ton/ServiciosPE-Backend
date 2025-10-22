// backend/src/models/Review.js

import mongoose from 'mongoose';

const ownerReplySchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 200, default: '' },

  // NUEVO: respuesta del dueño
  ownerReply: { type: ownerReplySchema, default: null },
}, { timestamps: true });

export default mongoose.model('Review', reviewSchema);
