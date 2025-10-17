// backend/src/routes/places.js
import express from 'express';
import { googlePhotoUrl } from '../utils/places.js';

const router = express.Router();

// GET /api/places/photo?ref=PHOTO_REFERENCE&maxwidth=400
router.get('/photo', async (req, res) => {
  try {
    const ref = req.query.ref;
    const maxwidth = Number(req.query.maxwidth || 400);
    if (!ref) return res.status(400).send('Missing ref');

    const url = googlePhotoUrl({ photoRef: ref, maxwidth });
    if (!url) return res.status(400).send('Photo not available');

    // Redirigimos a Google (cumple términos y no almacenamos)
    return res.redirect(url);
  } catch (e) {
    return res.status(500).send('Photo error');
  }
});

export default router;
