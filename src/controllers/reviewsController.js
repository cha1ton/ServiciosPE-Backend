// backend/src/controllers/reviewsController.js

import Review from '../models/Review.js';
import Service from '../models/Service.js';
import { containsBadWords } from '../utils/badWords.js';

const REPLY_EDIT_WINDOW_MIN = 15;

export const listReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const reviews = await Review.find({ service: serviceId })
      .sort({ createdAt: -1 })
      .lean();

    // ¿El solicitante es el dueño del servicio?
    let canReply = false;
    if (req.user?._id) {
      const svc = await Service.findById(serviceId).select('owner').lean();
      canReply = !!(svc && String(svc.owner) === String(req.user._id));
    }

    return res.json({
      success: true,
      reviews,
      canReply,
      replyEditWindowMinutes: REPLY_EDIT_WINDOW_MIN,
    });
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

// NUEVO: responder/editar respuesta del dueño
export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    let { text } = req.body;

    text = (text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'La respuesta no puede estar vacía' });
    if (text.length > 300) return res.status(400).json({ success: false, message: 'La respuesta no puede exceder 300 caracteres' });
    if (containsBadWords(text)) return res.status(400).json({ success: false, message: 'La respuesta contiene lenguaje ofensivo' });

    const review = await Review.findById(reviewId).populate('service', 'owner').exec();
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });

    // Permitir solo al dueño del servicio
    if (!review.service || String(review.service.owner) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'No autorizado para responder esta reseña' });
    }

    const now = new Date();
    const windowMs = REPLY_EDIT_WINDOW_MIN * 60 * 1000;

    if (!review.ownerReply) {
      // Crear respuesta
      review.ownerReply = { text, createdAt: now, updatedAt: now };
    } else {
      // Editar: solo dentro de la ventana
      const diff = now - new Date(review.ownerReply.createdAt);
      if (diff > windowMs) {
        return res.status(403).json({
          success: false,
          message: `La ventana de edición de ${REPLY_EDIT_WINDOW_MIN} minutos ha expirado`,
        });
      }
      review.ownerReply.text = text;
      review.ownerReply.updatedAt = now;
    }

    await review.save();

    return res.json({
      success: true,
      review: {
        _id: review._id,
        ownerReply: review.ownerReply,
      }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al responder reseña' });
  }
};