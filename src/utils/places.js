// backend/src/utils/places.js
import fetch from 'node-fetch';

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
console.log('PLACES_KEY?', process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)

// Caché en memoria (clave → { data, expireAt })
const cache = new Map();
const now = () => Date.now();
const setCache = (key, data, ttlMs) => cache.set(key, { data, expireAt: now() + ttlMs });
const getCache = (key) => {
  const v = cache.get(key);
  if (!v) return null;
  if (v.expireAt < now()) { cache.delete(key); return null; }
  return v.data;
};

// Nearby search (radio en metros). Devuelve una lista normalizada.
export async function nearbyPlaces({ lat, lng, radius = 500, keyword = '', type = '' }) {
  if (!PLACES_KEY) return [];

  const key = `nearby:${lat.toFixed(5)}:${lng.toFixed(5)}:${radius}:${keyword}:${type}`;
  const cached = getCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    key: PLACES_KEY,
    location: `${lat},${lng}`,
    radius: String(radius),
  });
  if (keyword) params.set('keyword', keyword);
  if (type) params.set('type', type);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${PLACES_KEY}${type ? `&type=${type}` : ''}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`;

  console.log('[PLACES][REQ]', url);
  const resp = await fetch(url);
  console.log('[PLACES][STATUS]', resp.status, resp.statusText);
  const data = await resp.json();
  console.log('[PLACES][BODY.first]', JSON.stringify(data.results?.slice(0, 3) || data, null, 2));

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

  const items = (data.results || []).map((p) => {
    const photoRefs = (p.photos || [])
      .slice(0, 3)
      .map(ph => ph.photo_reference);

    console.log('[PLACES][PHOTOS]', {
      name: p.name,
      totalPhotos: p.photos?.length || 0,
      usedRefs: photoRefs.length,
    });

    return {
      source: 'google',
      placeId: p.place_id,
      name: p.name,
      category: (p.types && p.types[0]) || 'otros',
      coordinates: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng },
      address: { formatted: p.vicinity || '' },
      rating: { average: p.rating || 0, count: p.user_ratings_total || 0 },
      openNow: p.opening_hours?.open_now ?? undefined,
      photoRefs,
    };
  });


  // Cache 5 minutos
  setCache(key, items, 5 * 60 * 1000);
  return items;

}

// Proxy de fotos: construye URL de photo API
export function googlePhotoUrl({ photoRef, maxwidth = 400 }) {
  if (!PLACES_KEY || !photoRef) return '';
  const params = new URLSearchParams({
    key: PLACES_KEY,
    photoreference: photoRef,
    maxwidth: String(maxwidth),
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}
