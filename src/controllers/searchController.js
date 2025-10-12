// backend/src/controllers/searchController.js
import Service from '../models/Service.js';

// Haversine en metros
function distanceMeters(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // radio Tierra
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isOpenNow(schedule, now = new Date()) {
  if (!schedule) return true; // si no hay horario, no bloqueamos en MVP

  // Día de la semana en inglés → tu schema está en español
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayKey = days[now.getDay()];
  const todays = schedule[dayKey];
  if (!todays || !todays.open || !todays.close) return false;

  // Asumimos horario local del servidor en formato HH:mm
  const [oh, om] = todays.open.split(':').map(Number);
  const [ch, cm] = todays.close.split(':').map(Number);

  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  const curM = now.getHours() * 60 + now.getMinutes();

  // No cubrimos horarios que cruzan medianoche en MVP (simple)
  return curM >= openM && curM <= closeM;
}

export const searchServices = async (req, res) => {
  try {
    const {
      lat, lng,
      radius = 1000,               // en metros
      category,                     // opcional
      openNow: openNowFlag,         // "1" | "0"
      q,                            // texto libre
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

    // Filtro base en memoria (solo activos)
    const base = { isActive: true };
    if (category) base.category = category;

    // Traemos campos necesarios; evitamos enviar base64
    const docs = await Service.find(base)
      .select('name category address schedule rating contact images createdAt')
      .lean();

    // Filtrado por texto (MVP simple: name/description no está seleccionado; usamos name)
    const text = (q || '').trim().toLowerCase();
    const filtered = docs.filter((s) => {
      // Debe tener coords
      const c = s?.address?.coordinates;
      if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') return false;

      // Distancia
      const d = distanceMeters(center, { lat: c.lat, lng: c.lng });
      if (isFinite(maxDist) && d > maxDist) return false;

      // Abierto ahora
      if (openNowFlag === '1' && !isOpenNow(s.schedule)) return false;

      // Texto
      if (text) {
        const hay =
          (s.name || '').toLowerCase().includes(text) ||
          (s?.contact?.phone || '').toLowerCase().includes(text);
        if (!hay) return false;
      }

      // Guardo distancia calculada para ordenar
      s.__distance = d;
      return true;
    });

    // Orden: más cerca primero
    filtered.sort((a, b) => (a.__distance || 0) - (b.__distance || 0));

    // Paginación
    const total = filtered.length;
    const start = (pageNum - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filtered.slice(start, end);

    // Mapeo de respuesta (miniatura de imagen si hay)
    const results = pageItems.map((s) => {
      const firstImg = s.images?.[0];
      let thumb = '';
      if (firstImg?.data) {
        thumb = `data:image/${firstImg.format || 'jpeg'};base64,${firstImg.data}`;
      }
      return {
        id: s._id,
        name: s.name,
        category: s.category,
        distanceMeters: Math.round(s.__distance || 0),
        coordinates: s.address?.coordinates,
        address: {
          formatted: s.address?.formatted || '',
          street: s.address?.street || '',
          district: s.address?.district || '',
          city: s.address?.city || '',
        },
        rating: s.rating || { average: 0, count: 0 },
        contact: s.contact || {},
        image: thumb, // opcional
        createdAt: s.createdAt,
      };
    });

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: pageSize,
      results
    });
  } catch (e) {
    console.error('Error en búsqueda:', e);
    res.status(500).json({ success: false, message: 'Error en búsqueda' });
  }
};
