// backend/src/utils/geocoding.js

import fetch from "node-fetch";

function haversineMeters(a, b) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function geocodeAddress(address) {
  const { street = "", district = "", city = "" } = address || {};
  const query = [street, district, city, "Perú"].filter(Boolean).join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_API_KEY}&region=pe`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Error llamando a Geocoding API");
  const data = await resp.json();
  console.log('[Geocoding status]', data.status, data.error_message || '');


  if (!data.results?.length) return { ok: false, reason: "NO_RESULTS" };

  // Maneja estados explícitos de la API
  if (data.status !== "OK") {
    // Devuelve códigos claros para el controller
    return { ok: false, reason: data.status, error_message: data.error_message };
  }

  const top = data.results[0];
  const loc = top.geometry?.location || {};
  const country = top.address_components?.find(c => c.types.includes("country"))?.short_name;

  if (country !== "PE") return { ok: false, reason: "NOT_IN_PERU" };

  return {
    ok: true,
    formattedAddress: top.formatted_address,
    location: { lat: loc.lat, lng: loc.lng },
    placeId: top.place_id,
    confidence: (top.geometry?.location_type === "ROOFTOP" ? 1 : 0.8) * (top.partial_match ? 0.8 : 1),
  };
}

export async function validateAndNormalizeLocation({ address, coordinates }) {
  const gc = await geocodeAddress(address);
  if (!gc.ok) return { ok: false, reason: gc.reason };

  let distanceMeters = null;
  if (coordinates?.lat != null && coordinates?.lng != null) {
    distanceMeters = haversineMeters(
      { lat: Number(coordinates.lat), lng: Number(coordinates.lng) },
      { lat: Number(gc.location.lat), lng: Number(gc.location.lng) }
    );
    if (distanceMeters > 150) return { ok: false, reason: "COORDINATES_MISMATCH", distanceMeters };
  }

  const normalizedAddress = {
    ...address,
    formatted: gc.formattedAddress,
    placeId: gc.placeId,
    coordinates: { lat: gc.location.lat, lng: gc.location.lng },
  };

  return { ok: true, normalizedAddress, confidence: gc.confidence, distanceMeters };
}
