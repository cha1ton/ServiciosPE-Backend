// backend/src/routes/adminRoutes.js
import express from 'express';
import User from '../models/User.js';
import Service from '../models/Service.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso no autorizado (admin requerido)' 
      });
    }
    next();
  } catch (e) {
    console.error('Error en requireAdmin:', e);
    return res.status(500).json({ 
      success: false, 
      message: 'Error de autorización' 
    });
  }
}

// Todo lo que cuelga de /api/admin pasa por JWT + admin
router.use(authenticateJWT, requireAdmin);

// GET /api/admin/services
router.get('/services', async (req, res) => {
  try {
    const services = await Service.find({})
      .select('name category isActive owner createdAt')
      .populate('owner', 'email name role')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      total: services.length,
      services
    });
  } catch (e) {
    console.error('Error listando servicios (admin):', e);
    return res.status(500).json({ success: false, message: 'Error obteniendo servicios' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({})
      .select('email name role isActive createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (e) {
    console.error('Error listando usuarios (admin):', e);
    return res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
});

export default router;
