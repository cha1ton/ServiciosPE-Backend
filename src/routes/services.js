// backend/src/routes/services.js

import express from 'express';
import { createService, getMyServices } from '../controllers/serviceController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadMiddleware, validateImageCount } from '../middleware/upload.js';

const router = express.Router();

router.post('/', 
  authenticateJWT,
  uploadMiddleware,
  validateImageCount,
  createService
);

router.get('/my-services', authenticateJWT, getMyServices);

export default router;