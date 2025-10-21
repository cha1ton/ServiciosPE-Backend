// backend/src/routes/user.js

import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { listFavorites, toggleFavorite } from '../controllers/favoritesController.js';

const router = express.Router();

router.get('/favorites', authenticateJWT, listFavorites);
router.post('/favorites/:serviceId/toggle', authenticateJWT, toggleFavorite);

export default router;
