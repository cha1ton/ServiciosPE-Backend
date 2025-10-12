// backend/src/routes/services.js

import express from 'express';
import { createService, getMyServices } from '../controllers/serviceController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadMiddleware, validateImageCount } from '../middleware/upload.js';
import { getMySingleService, updateMyService } from '../controllers/serviceEditController.js';
import { validateImageCountOnUpdate } from '../middleware/uploadUpdate.js';

const router = express.Router();

router.post('/', 
  authenticateJWT,
  uploadMiddleware,
  validateImageCount,
  createService
);

router.get('/my-services', authenticateJWT, getMyServices);

// Obtener mi negocio (uno solo)
router.get('/my-service', authenticateJWT, getMySingleService);

// Editar mi negocio (reemplazo opcional de imágenes)
router.put(
  '/my-service',
  authenticateJWT,
  uploadMiddleware,            // acepta hasta 3 archivos
  validateImageCountOnUpdate,  // si manda imágenes, deben ser 3 para reemplazar
  updateMyService
);

export default router;