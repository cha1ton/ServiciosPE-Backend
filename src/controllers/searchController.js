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

// Normalización básica para búsqueda (tokens + pseudo-stemming liviano)
function normalizeText(s = '') {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensFrom(text = '') {
  const base = normalizeText(text).split(' ').filter(Boolean);
  // stemming muy simple en español
  return base.map(t => t
    .replace(/(mente|mente$)/, '')
    .replace(/(aciones|acion|adora|adores|ador|adoras|ados|adas|ado|ada)$/,'')
    .replace(/(amientos|amiento|imiento|iciones|icion)$/,'')
    .replace(/(mente|idad|idades|ismo|ista|istas)$/,'')
    .replace(/(ando|iendo|arar|erar|irar|ar|er|ir)$/,'')
    .replace(/(es|s)$/,'')
  );
}

const CATEGORY_SYNONYMS = {
  restaurante: [
    'restaurante', 'restaurantes', 'comer', 'almorzar', 'cena', 'cenar',
    'menú', 'menu', 'polleria', 'pollerías', 'parrilla', 'cevicheria',
    'cevichería', 'comida', 'cocina', 'almuerzo', 'trattoria', 'sangucheria', 'sanguchería'
  ],
  comida_bebidas: [
    'cafetería', 'cafeteria', 'café', 'panadería', 'panaderia', 'pastelería',
    'pasteleria', 'postres', 'jugueria', 'juguería', 'heladería', 'heladeria',
    'dulces', 'repostería', 'reposteria', 'coffee', 'bakery'
  ],
  centro_salud: [
    'salud', 'clinica', 'clínica', 'hospital', 'doctor', 'doctora', 'médico',
    'medico', 'odontologia', 'odontología', 'dentista', 'psicologo', 'psicóloga',
    'terapia', 'consultorio', 'fisioterapia', 'laboratorio'
  ],
  farmacia: [
    'farmacia', 'botica', 'medicina', 'medicinas','medicamento','medicamentos', 'boticas', 'farmacias',
    'remedios', 'farmacéutica', 'farmaceutica'
  ],
  veterinaria: [
    'veterinaria', 'vet', 'mascotas', 'perros', 'gatos', 'animal', 'animales',
    'pet shop', 'clínica veterinaria'
  ],
  supermercado: [
    'supermercado', 'super', 'mercado', 'plaza vea', 'tottus', 'metro', 'wong',
    'makro', 'hipermercado', 'centro comercial',
    'minimarket', 'mini market', 'tienda', 'bodega', 'abarrotes', 'mercadito',
    'kiosko', 'colmado', 'market', 'mini', 'tambo', 'oxxo', 'mass'
  ],
  hotel: [
    'hotel', 'hostal', 'hospedaje', 'alojamiento', 'motel', 'posada', 'habitacion',
    'habitaciones', 'noche', 'dormir', 'suite', 'residencial'
  ],
  gimnasio: [
    'gimnasio', 'gym', 'crossfit', 'pesas', 'entrenamiento','entrenar', 'fitness',
    'deporte', 'ejercicio', 'musculacion', 'musculación', 'rutina'
  ],
  escuela_baile: [
    'baile', 'bailar', 'danza', 'salsa', 'bachata', 'escuela', 'academia',
    'clases de baile', 'coreografía', 'taller de baile'
  ],
  taller_mecanico: [
    'taller', 'mecanico', 'mecánico', 'autos', 'carros', 'vehículos', 'motor',
    'frenos', 'aceite', 'automotriz', 'servicio técnico', 'reparación de autos'
  ],
  lavanderia: [
    'lavanderia', 'lavandería', 'lavado', 'ropa', 'planchado', 'tintoreria',
    'tintorería', 'seco', 'servicio de lavado'
  ],
  barberia: [
    'barbería', 'barberia', 'barbero', 'corte de cabello', 'afeitado', 'peluquería masculina',
    'peinado', 'cabello hombres', 'barba', 'look', 'haircut'
  ],
  salon_belleza: [
    'salón de belleza', 'salon de belleza', 'peluquería', 'spa', 'manicure', 'pedicure',
    'maquillaje', 'peinado', 'alisado', 'tinte', 'uñas', 'tratamiento capilar'
  ],
  discoteca: [
    'discoteca', 'discotecas', 'bar', 'pub', 'club', 'night club', 'club nocturno',
    'fiesta', 'nocturno', 'antro', 'karaoke'
  ],
  otros: [
    'servicio', 'negocio', 'empresa', 'local', 'tienda', 'oficina'
  ]
};

function inferCategoryFromQuery(q = '') {
  const qn = normalizeText(q);
  for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const s of syns) {
      if (qn.includes(normalizeText(s))) return cat;
    }
  }
  return '';
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

  const takenGoogle = new Set();
  const merged = [...L];

  for (const g of G) {
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
    .sort((a, b) =>
      (a.__boost || 0) - (b.__boost || 0) ||  // 1º: más NEGATIVO primero (más similar)
      (a.__distance || 0) - (b.__distance || 0) // 2º: luego por cercanía
    )
    .map(({ __distance, __boost, ...rest }) => ({
      ...rest,
      distanceMeters: Math.round(__distance || 0),
    }));
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
    const text = (q || '').trim();
    const qTokens = tokensFrom(text);
    const inferredCat = !category ? inferCategoryFromQuery(text) : '';

    // 1) Determinar categoría efectiva UNA VEZ
    const effectiveCategory = category || (
      inferredCat && ['restaurante','comida_bebidas','centro_salud','farmacia',
        'veterinaria','supermercado','hotel','gimnasio','escuela_baile',
        'taller_mecanico','lavanderia','barberia','salon_belleza','discoteca','otros',
      ].includes(inferredCat) ? inferredCat : ''
    );

    
    // 2) Tus servicios (local DB)
    const base = { isActive: true };
    if (effectiveCategory) base.category = effectiveCategory;

    const docs = await Service.find(base)
      .select('name category address schedule rating contact images createdAt')
      .lean();
    const queryNameNorm = normalizeName(text);
    const locals = docs
      .filter(s => s?.address?.coordinates && typeof s.address.coordinates.lat === 'number')
      .filter(s => {
        if (openNowFlag === '1' && !isOpenNow(s.schedule)) return false;
        if (!text) return true;
        const haystack = normalizeText([
          s.name,
          s.description,
          s.offerings,
          s?.address?.formatted,
          s?.address?.street,
          s?.address?.district,
          s?.address?.city,
          s.category,
        ].filter(Boolean).join(' '));
        const tokens = new Set(tokensFrom(haystack));
        // match por tokens o por sinónimos de categorías
        const tokenHit = qTokens.some(t => tokens.has(t));
        let synonymHit = false;
        for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
          if (syns.some(w => haystack.includes(normalizeText(w))) && (!effectiveCategory || effectiveCategory === cat || s.category === cat)) {
            // si el query menciona palabras de esta categoría, considéralo match
            if (qTokens.some(t => syns.map(normalizeText).some(sw => sw.includes(t) || t.includes(sw)))) {
              synonymHit = true; break;
            }
          }
        }
        return tokenHit || synonymHit;
      })
      .map(s => {
        const firstImg = s.images?.[0];
        let image = '';
        if (firstImg?.data) {
          image = `data:image/${firstImg.format || 'jpeg'};base64,${firstImg.data}`;
        }

        // 🟢 BOOST por parecido de nombre (cuando hay q)
        let __boost = 0;
        if (queryNameNorm) {
          const sim = nameSimilarity(s.name, text); // usa el texto original del usuario
          // Si sim >= 0.60 (tolerante a 1–2 typos), empuja hacia arriba.
          if (sim >= 0.60) {
            __boost = -Math.round(sim * 1000); // p.ej., sim 0.86 => -860
          }
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
          __boost,
        };
      });

    // 3) Google Places (Nearby)
    // Mapear 'category' opcional a un type simple (MVP)
    const typeMap = {
      restaurante: 'restaurant',
      comida_bebidas: 'cafe',
      centro_salud: 'hospital',
      farmacia: 'pharmacy',
      veterinaria: 'veterinary_care',
      supermercado: 'supermarket', // manejado aparte con convenience_store
      hotel: 'lodging',
      gimnasio: 'gym',
      escuela_baile: 'school',
      taller_mecanico: 'car_repair',
      lavanderia: 'laundry',
      barberia: 'hair_care',
      salon_belleza: 'beauty_salon',
      discoteca: 'night_club',
      otros: ''
    };

    let googleRaw = [];
    if (effectiveCategory === 'supermercado') {
      const common = { lat: center.lat, lng: center.lng, radius: maxDist, keyword: text || '' };
      const [superm, conv] = await Promise.all([
        nearbyPlaces({ ...common, type: 'supermarket' }),
        nearbyPlaces({ ...common, type: 'convenience_store' }),
      ]);
      googleRaw = [...superm, ...conv];
    } else {
      const type = effectiveCategory ? (typeMap[effectiveCategory] || '') :
                  (inferredCat ? (typeMap[inferredCat] || '') : '');
      googleRaw = await nearbyPlaces({
        lat: center.lat, lng: center.lng, radius: maxDist, keyword: text || '', type
      });
    }

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
        contact: {},
        image: g.photoRefs?.[0]
          ? googlePhotoUrl({ photoRef: g.photoRefs[0], maxwidth: 400 })
          : '',
        photoRefs: g.photoRefs || [],
      }));

    // 4) Merge + dedupe
    const merged = dedupeMerge(center, locals, googleFiltered, maxDist);

    // 5) Paginación
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
