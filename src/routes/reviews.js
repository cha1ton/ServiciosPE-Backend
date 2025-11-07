// backend/src/routes/reviews.js

import express from 'express';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';
import { listReviews, createReview, replyToReview, getUnreadReplies, markReplyRead, markOwnerSeen } from '../controllers/reviewsController.js';

const router = express.Router();

// Rutas específicas primero para evitar colisiones con '/:serviceId'
// Notificaciones: respuestas no leídas del dueño hacia el autor
router.get('/unread', authenticateJWT, getUnreadReplies);
router.post('/mark-read/:reviewId', authenticateJWT, markReplyRead);
router.post('/mark-owner-seen/:reviewId', authenticateJWT, markOwnerSeen);

// responder/editar (solo dueño del servicio)
router.post('/reply/:reviewId', authenticateJWT, replyToReview);

// listar es público, pero con optionalAuth para saber si es dueño (canReply)
router.get('/:serviceId', optionalAuth, listReviews);

// crear reseña (usuario logueado)
router.post('/:serviceId', authenticateJWT, createReview);

export default router;

