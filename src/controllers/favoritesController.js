// backend/src/controllers/favoritesController.js

import User from '../models/User.js';
import Service from '../models/Service.js';

export const listFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    const favorites = (user?.favorites || []).map(id => String(id));
    return res.json({ success: true, favorites });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al obtener favoritos' });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const svc = await Service.findById(serviceId).select('_id').lean();
    if (!svc) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });

    const user = await User.findById(req.user._id);
    const idx = user.favorites.findIndex(f => String(f) === String(serviceId));
    let isFavorite = false;
    if (idx >= 0) {
      user.favorites.splice(idx, 1);
      isFavorite = false;
    } else {
      user.favorites.push(serviceId);
      isFavorite = true;
    }
    await user.save();
    return res.json({ success: true, isFavorite });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al actualizar favoritos' });
  }
};
