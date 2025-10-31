// backend/src/server.js

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import placesRoutes from './routes/places.js';
import userRoutes from './routes/user.js';
import reviewsRoutes from './routes/reviews.js';
import aiRoutes from './routes/ai.js';

dotenv.config();

const app = express();
console.log('Maps key cargada?:', !!process.env.GOOGLE_MAPS_API_KEY);

// ★ Render/Proxies: habilita cookies secure detrás de proxy
app.set('trust proxy', 1); // ★

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviciospe')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": [
        "'self'",
        "data:",
        "https://*.googleusercontent.com",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com"
      ],
    },
  },
}));
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ★ CORS allowlist dev+prod
const allowedOrigins = [
  process.env.FRONTEND_URL,    // prod: https://serviciospe.vercel.app
  'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // allow non-browser (e.g., curl/postman) or same-origin
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsOptions));        // ★ aplica CORS global
app.options('*', cors(corsOptions)); // ★ preflight global

// Parsers (coloca después de CORS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/ai', aiRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend ServiciosPE funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Errores
app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'El archivo es demasiado grande. Máximo 1MB permitido para foto de perfil.'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'El cuerpo de la solicitud es demasiado grande. Máximo 1MB permitido.'
    });
  }

  // CORS error explícito
  if (String(error.message || '').includes('not allowed by CORS')) {
    return res.status(403).json({ success: false, message: error.message });
  }

  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
