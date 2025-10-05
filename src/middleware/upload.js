//src/middleware/upload.js
import multer from 'multer';
import path from 'path';

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Filtro para validar imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPEG, JPG, PNG, GIF, WEBP)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB máximo
  },
  fileFilter: fileFilter
});

// Middleware para validar máximo 3 imágenes
export const validateImageCount = (req, res, next) => {
  if (req.files && req.files.length > 3) {
    return res.status(400).json({
      success: false,
      message: 'No se pueden subir más de 3 imágenes'
    });
  }
  next();
};

export const uploadMiddleware = upload.array('images', 3); // Máximo 3 archivos
