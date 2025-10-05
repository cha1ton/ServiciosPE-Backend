// backend/src/controllers/authController.js
import { generateToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { ImageService } from '../utils/imageService.js';

export const authSuccess = (req, res) => {
  if (!req.user) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }

  console.log('Usuario en authSuccess:', {
    id: req.user._id,
    name: req.user.name,
    photo: req.user.photo, // Verificar qué hay aquí
    hasPhoto: !!req.user.photo
  });

  const token = generateToken({ 
    userId: req.user._id,
    email: req.user.email 
  });

  res.redirect(`${process.env.FRONTEND_URL}/success?token=${token}`);
};

export const authFailure = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
};

export const getProfile = async (req, res) => {
  try {
    // 🔥 IMPORTANTE: Buscar el usuario fresco desde la base de datos
    const userFromDB = await User.findById(req.user._id).select('-password');
    
    if (!userFromDB) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Usuario desde DB:', {
      id: userFromDB._id,
      email: userFromDB.email,
      name: userFromDB.name,
      photo: userFromDB.photo,
      nickname: userFromDB.nickname,
      customPhoto: userFromDB.customPhoto,
      role: userFromDB.role
    });

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
    console.error('❌ Error en getProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { nickname } = req.body;
    let customPhoto = null;

    // Si se subió una nueva imagen, procesarla
    if (req.file) {
      const processedImage = await ImageService.processProfileImage(req.file.buffer);
      customPhoto = processedImage.data;
    }

    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (customPhoto !== undefined && customPhoto !== null) {
      updateData.customPhoto = customPhoto;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        photo: updatedUser.photo,
        nickname: updatedUser.nickname,
        customPhoto: updatedUser.customPhoto,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    
    if (error.message.includes('Solo se permiten imágenes')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
};

export const logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  });
};