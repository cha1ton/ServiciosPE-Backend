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

    // Si el visitante es el dueño, marcar reseñas como vistas por el owner
    if (canReply) {
      try {
        await Review.updateMany({ service: serviceId, ownerSeen: false }, { $set: { ownerSeen: true } });
      } catch (e) {
        console.error('Error marcando ownerSeen:', e);
      }
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
      return res.status(400).json({ success: false, message: 'Tu reseña contiene lenguaje inapropiado. Por favor edítala.' });
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
      // Crear respuesta (marcar como NO leída por el autor)
      review.ownerReply = { text, createdAt: now, updatedAt: now, read: false };
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
      // Si el dueño edita la respuesta, volver a marcar como no leída
      review.ownerReply.read = false;
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

// Obtener respuestas no leídas para el usuario (author)
export const getUnreadReplies = async (req, res) => {
  try {
    // Guardia defensiva: si no hay usuario, responder 401
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const userId = req.user._id;
    console.log('GET /api/reviews/unread - user:', String(userId));

    // 1) Notificaciones para el autor: respuestas no leídas
    const authorReviews = await Review.find({
      author: userId,
      'ownerReply.read': false,
      'ownerReply.text': { $exists: true }
    })
      .sort({ 'ownerReply.createdAt': -1 })
      .populate('service', 'name')
      .lean();

    // 2) Notificaciones para el owner: nuevas reseñas en sus servicios
    const servicesOwned = await Service.find({ owner: userId }).select('_id name').lean();
    const serviceIds = servicesOwned.map(s => s._id);

    const ownerReviews = serviceIds.length > 0 ? await Review.find({
      service: { $in: serviceIds },
      ownerSeen: false
    })
      .sort({ createdAt: -1 })
      .populate('service', 'name')
      .populate('author', 'nickname name')
      .lean() : [];

    console.log('GET /api/reviews/unread - author count:', authorReviews.length, 'owner count:', ownerReviews.length);

    const authorItems = authorReviews.map(r => ({
      type: 'owner_reply',
      reviewId: r._id,
      serviceId: r.service?._id || null,
      serviceTitle: r.service?.name || '',
      ownerReply: r.ownerReply,
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    const ownerItems = ownerReviews.map(r => ({
      type: 'new_review',
      reviewId: r._id,
      serviceId: r.service?._id || null,
      serviceTitle: r.service?.name || '',
      authorName: r.author?.nickname || r.author?.name || 'Alguien',
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    const items = [...authorItems, ...ownerItems];
    return res.json({ success: true, items, count: items.length });
  } catch (err) {
    console.error('Error getting unread replies:', err);
    // En desarrollo, devolver el mensaje de error para facilitar debugging
    const payload = { success: false, message: 'Error al obtener respuestas no leídas' };
    if (process.env.NODE_ENV !== 'production' && err && err.message) payload.error = err.message;
    return res.status(500).json(payload);
  }
};

// Marcar la respuesta como leída por el autor
export const markReplyRead = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({ _id: reviewId, author: userId });
    if (!review || !review.ownerReply) return res.status(404).json({ success: false, message: 'Reseña o respuesta no encontrada' });

    review.ownerReply.read = true;
    await review.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Error marking reply read:', err);
    return res.status(500).json({ success: false, message: 'Error al marcar como leída' });
  }
};

// Marcar reseña como vista por el owner
export const markOwnerSeen = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId).populate('service', 'owner').exec();
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });

    if (!review.service || String(review.service.owner) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    review.ownerSeen = true;
    await review.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Error marking owner seen:', err);
    return res.status(500).json({ success: false, message: 'Error al marcar como vista' });
  }
};