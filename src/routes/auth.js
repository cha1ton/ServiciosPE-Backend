// backend/src/routes/auth.js

import express from 'express';
import passport from '../config/passport.js';
import { uploadProfilePhoto } from '../middleware/uploadProfile.js';
import { 
  authSuccess, 
  authFailure, 
  getProfile, 
  updateProfile, 
  logout 
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

import User from '../models/User.js'; // Importar segun GPT incognito

const router = express.Router();

// Rutas de Google OAuth
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/failure',
    session: false 
  }),
  authSuccess
);

// Rutas de perfil protegidas con JWT
router.get('/profile', authenticateJWT, getProfile);
router.put('/profile', authenticateJWT, uploadProfilePhoto, updateProfile);

router.post('/logout', authenticateJWT, logout);
router.get('/failure', authFailure);

// Ruta para verificar token
// Ruta para verificar token - CORREGIDA
router.get('/verify', authenticateJWT, async (req, res) => {
  try {
    // 🔥 IMPORTANTE: Buscar usuario fresco desde la base de datos
    const userFromDB = await User.findById(req.user._id).select('-password');
    
    if (!userFromDB) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: userFromDB._id,
        email: userFromDB.email,
        name: userFromDB.name,
        photo: userFromDB.photo || '',
        nickname: userFromDB.nickname || '',
        customPhoto: userFromDB.customPhoto || '',
        role: userFromDB.role || 'user'
      }
    });
  } catch (error) {
    console.error('❌ Error en verify endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar token'
    });
  }
});

export default router;
