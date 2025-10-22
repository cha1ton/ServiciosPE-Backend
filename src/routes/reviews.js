// backend/src/routes/reviews.js

import express from 'express';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';
import { listReviews, createReview, replyToReview } from '../controllers/reviewsController.js';

const router = express.Router();

// listar es público, pero con optionalAuth para saber si es dueño (canReply)
router.get('/:serviceId', optionalAuth, listReviews);

// crear reseña (usuario logueado)
router.post('/:serviceId', authenticateJWT, createReview);

// responder/editar (solo dueño del servicio)
router.post('/reply/:reviewId', authenticateJWT, replyToReview);

export default router;

