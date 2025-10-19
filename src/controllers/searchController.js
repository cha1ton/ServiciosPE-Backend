// backend/src/controllers/searchController.js
import Service from '../models/Service.js';
import { nearbyPlaces, googlePhotoUrl } from '../utils/places.js';

// Haversine en metros
function distanceMeters(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Normaliza nombre para comparar (rápido y suficiente)
function normalizeName(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/\b(s\.?a\.?c?|srl|s\.?r\.?l\.?|restaurant|restaurante|cafeteria|bodega|botica|clinica|centro|local)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Similaridad de nombres simple (coeficiente de Jaccard por bigramas)
function nameSimilarity(a, b) {
  const nA = normalizeName(a), nB = normalizeName(b);
  if (!nA || !nB) return 0;
  const grams = (t) => {
    const g = new Set();
    const s = ` ${t} `;
    for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
    return g;
  };
  const A = grams(nA), B = grams(nB);
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function isOpenNow(schedule, now = new Date()) {
  if (!schedule) return true;
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const k = days[now.getDay()];
  const t = schedule[k];
  if (!t || !t.open || !t.close) return false;
  const toM = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const openM = toM(t.open), closeM = toM(t.close);
  const curM = now.getHours() * 60 + now.getMinutes();
  return curM >= openM && curM <= closeM;
}

// Dedupe: misma ubicación (≤30 m) y nombre parecido (≥0.8)
function dedupeMerge(center, localItems, googleItems, radius) {
  const MAX_DIST_SAME = 30;     // metros
  const NAME_SIMILAR = 0.8;

  // Calcula distancias desde center
  const withDist = (arr) => arr.map((x) => {
    const d = distanceMeters(center, x.coordinates);
    return { ...x, __distance: d };
  });

  const L = withDist(localItems);
  const G = withDist(googleItems);

  // Índice de locales por celda gruesa para acelerar (opcional simple)
  // Aquí iremos directo por simplicidad: O(n*m) pero con radios chicos no molesta.

  const takenGoogle = new Set();
  const merged = [...L];

  for (const g of G) {
    // Solo consideramos g si está dentro del radio
    if (g.__distance > radius) continue;

    let duplicateOfLocal = false;
    for (const l of L) {
      const d = distanceMeters(l.coordinates, g.coordinates);
      if (d <= MAX_DIST_SAME) {
        const sim = nameSimilarity(l.name, g.name);
        if (sim >= NAME_SIMILAR) {
          duplicateOfLocal = true;
          break;
        }
      }
    }
    if (!duplicateOfLocal) {
      merged.push(g);
      takenGoogle.add(g.placeId);
    }
  }

  // Orden por distancia y retorno sin campos internos
  return merged
    .sort((a, b) => (a.__distance || 0) - (b.__distance || 0))
    .map(({ __distance, ...rest }) => ({ ...rest, distanceMeters: Math.round(__distance || 0) }));
}

export const searchServices = async (req, res) => {
  try {
    console.log('[SEARCH] q,lat,lng,radius,category,openNow:',
      req.query.q, req.query.lat, req.query.lng, req.query.radius, req.query.category, req.query.openNow);
    const {
      lat, lng,
      radius = 500,
      category,
      openNow: openNowFlag,
      q,
      page = 1,
      limit = 10
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Parámetros lat y lng son obligatorios' });
    }

    const center = { lat: Number(lat), lng: Number(lng) };
    const maxDist = Number(radius);
    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.min(50, Math.max(1, Number(limit)));
    const text = (q || '').trim().toLowerCase();

    // 1) Tus servicios (local DB)
    const base = { isActive: true };
    if (category) base.category = category;
    const docs = await Service.find(base)
      .select('name category address schedule rating contact images createdAt')
      .lean();

    const locals = docs
      .filter(s => s?.address?.coordinates && typeof s.address.coordinates.lat === 'number')
      .filter(s => {
        if (openNowFlag === '1' && !isOpenNow(s.schedule)) return false;
        if (text) {
          const hay = (s.name || '').toLowerCase().includes(text) ||
            (s?.contact?.phone || '').toLowerCase().includes(text);
          if (!hay) return false;
        }
        return true;
      })
      .map(s => {
        const firstImg = s.images?.[0];
        let image = '';
        if (firstImg?.data) {
          image = `data:image/${firstImg.format || 'jpeg'};base64,${firstImg.data}`;
        }
        return {
          source: 'serviciospe',
          id: String(s._id),
          name: s.name,
          category: s.category || 'otros',
          coordinates: { lat: s.address.coordinates.lat, lng: s.address.coordinates.lng },
          address: {
            formatted: s.address?.formatted || '',
            street: s.address?.street || '',
            district: s.address?.district || '',
            city: s.address?.city || '',
          },
          rating: s.rating || { average: 0, count: 0 },
          contact: s.contact || {},
          image,
          createdAt: s.createdAt,
        };
      });

    // 2) Google Places (Nearby)
    // Mapear 'category' opcional a un type simple (MVP)
    const typeMap = {
      restaurante: 'restaurant',
      centro_salud: 'hospital',
      lavanderia: 'laundry',   // puede no existir exacto; keyword fallback
      farmacia: 'pharmacy',
      supermercado: 'supermarket',
      otros: ''
    };
    const type = category ? (typeMap[category] || '') : '';
    const googleRaw = await nearbyPlaces({
      lat: center.lat, lng: center.lng, radius: maxDist,
      keyword: text || '', type
    });

    //Cambiamos esto:
    const googleFiltered = googleRaw
      .filter(g => g.coordinates?.lat != null && g.coordinates?.lng != null)
      .filter(g => {
        if (openNowFlag === '1' && g.openNow === false) return false;
        return true;
      })
      .map(g => ({
        source: 'google',
        id: g.placeId,
        name: g.name,
        category: g.category || 'otros',
        coordinates: g.coordinates,
        address: g.address,
        rating: g.rating,
        contact: {}, // no exponemos phone/email de Google en Nearby
        // ⬇️ aquí el cambio: URL directa a Google Photos API
        image: g.photoRef ? googlePhotoUrl({ photoRef: g.photoRef, maxwidth: 400 }) : '',
        createdAt: undefined,
    }));

    // 3) Merge + dedupe
    const merged = dedupeMerge(center, locals, googleFiltered, maxDist);

    // 4) Paginación
    const total = merged.length;
    const start = (pageNum - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = merged.slice(start, end);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: pageSize,
      results: pageItems
    });

  } catch (e) {
    console.error('Error en búsqueda combinada:', e);
    return res.status(500).json({ success: false, message: 'Error en búsqueda' });
  }
};
