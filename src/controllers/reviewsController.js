// backend/src/controllers/reviewsController.js

import Review from '../models/Review.js';
import Service from '../models/Service.js';
import { containsBadWords } from '../utils/badWords.js';

export const listReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const reviews = await Review.find({ service: serviceId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, reviews });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al listar reseñas' });
  }
};

export const createReview = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { rating, comment } = req.body;

    const svc = await Service.findById(serviceId).select('_id').lean();
    if (!svc) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });

    const cleanComment = (comment || '').trim();
    if (cleanComment.length > 200) {
      return res.status(400).json({ success: false, message: 'La reseña no puede exceder 200 caracteres' });
    }
    if (containsBadWords(cleanComment)) {
      return res.status(400).json({ success: false, message: 'Tu reseña contiene lenguaje ofensivo' });
    }

    const review = await Review.create({
      service: serviceId,
      author: req.user._id,
      authorName: req.user.nickname || req.user.name,
      rating: Number(rating) || 5,
      comment: cleanComment,
    });

    // 🔁 Recalcular promedio y conteo
    const agg = await Review.aggregate([
      { $match: { service: review.service } },
      { $group: { _id: '$service', avg: { $avg: '$rating' }, cnt: { $count: {} } } }
    ]);

    const avg = agg[0]?.avg || 0;
    const cnt = agg[0]?.cnt || 0;

    await Service.findByIdAndUpdate(serviceId, {
      $set: { 'rating.average': Number(avg.toFixed(1)), 'rating.count': cnt }
    });

    return res.status(201).json({ success: true, review });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al crear reseña' });
  }
};

