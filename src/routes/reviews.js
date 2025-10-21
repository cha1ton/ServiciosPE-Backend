// backend/src/routes/reviews.js

import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { listReviews, createReview } from '../controllers/reviewsController.js';

const router = express.Router();

router.get('/:serviceId', listReviews);
router.post('/:serviceId', authenticateJWT, createReview);

export default router;
