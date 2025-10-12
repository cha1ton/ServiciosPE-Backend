// backend/src/routes/services.js

import express from 'express';
import { createService, getMyServices } from '../controllers/serviceController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadMiddleware, validateImageCount } from '../middleware/upload.js';
import { getMySingleService, updateMyService } from '../controllers/serviceEditController.js';
import { validateImageCountOnUpdate } from '../middleware/uploadUpdate.js';
import { searchServices } from '../controllers/searchController.js';

const router = express.Router();

router.post('/', 
  authenticateJWT,
  uploadMiddleware,
  validateImageCount,
  createService
);

router.get('/my-services', authenticateJWT, getMyServices);

// Obtener/editar mi negocio
router.get('/my-service', authenticateJWT, getMySingleService);
router.put('/my-service',
  authenticateJWT,
  uploadMiddleware,
  validateImageCountOnUpdate,
  updateMyService
);

// Búsqueda pública (no requiere auth)
router.get('/search', searchServices);

export default router;