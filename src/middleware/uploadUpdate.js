// backend/src/middleware/uploadUpdate.js
// Regla: si NO sube imágenes => conserva las actuales.
// Si SÍ sube => deben ser EXACTAMENTE 3 (reemplazo completo).
export const validateImageCountOnUpdate = (req, res, next) => {
  const count = (req.files && req.files.length) || 0;

  if (count === 0) return next();

  if (count !== 3) {
    return res.status(400).json({
      success: false,
      message: 'Para reemplazar las imágenes debes subir exactamente 3 archivos (2MB c/u).'
    });
  }

  next();
};
