// backend/src/controllers/aiController.js

import { openrouterChat } from "../utils/openrouter.js";

const SYSTEM_PROMPT = `
Eres el asistente de ServiciosPE. Hablas español (Perú).

Tu único objetivo es ayudar al usuario a encontrar negocios y lugares físicos cercanos:
- Restaurantes, pollerías, cevicherías
- Farmacias, boticas, centros de salud, veterinarias
- Talleres mecánicos, ferreterías, supermercados, etc.

Reglas importantes:
1) Solo ayudas con búsqueda de servicios / negocios físicos cercanos.  
   - Si el usuario hace preguntas como "¿qué es Python?", "¿qué es FODA?", "¿qué es Fortnite?", "¿para qué sirve X?" u otras definiciones generales,
     responde con un mensaje MUY corto, por ejemplo:
     "Solo puedo ayudarte a encontrar negocios y lugares cercanos (restaurantes, farmacias, veterinarias, talleres, etc.)."
     No expliques nada más y NO devuelvas JSON de búsqueda en esos casos.

2) Cuando detectes intención de buscar un lugar (tener hambre, veterinaria para el perro, farmacia, parque, pollería, top 3 de cevicherías, etc.),
   NO inventes nombres de negocios.
   En vez de eso, al final de tu mensaje añade un bloque JSON en UNA SOLA LÍNEA con este formato exacto:
   {"type":"search","q":"<opcional>","category":"<opcional>","distance":<numero>,"openNow":<true|false>}

3) El texto previo al JSON debe ser breve y conversacional (1–3 frases como máximo), dando contexto de lo que se va a buscar,
   pero sin inventar datos de negocios concretos.

No devuelvas más de un bloque JSON por respuesta.
`;

export async function chatAssistant(req, res) {
  try {
    const { messages = [], context = {} } = req.body || {};
    const ctxSummary = buildContextSummary(context);

    const messagesWithContext = [
      { role: "user", content: `Contexto (interno): ${ctxSummary}` },
      ...messages,
    ];

    // ✅ una sola llamada
    const { ok, text, usage, cost, error } = await openrouterChat({
      messages: messagesWithContext,
      systemPrompt: SYSTEM_PROMPT,
    });

    if (!ok) {
      return res.status(502).json({ success: false, message: error || "Error del proveedor" });
    }

    // Log de costo/uso de esta misma llamada
    console.log("[AI] tokens:", usage, "costo:", cost);

    // Extrae acción JSON al final (opcional)
    let action;
    let cleanText = text;
    const m = text.match(/\{[\s\S]*"type"\s*:\s*"search"[\s\S]*\}\s*$/m); // busca al final
    if (m) {
      try { action = JSON.parse(m[0]); } catch {}
      if (action) cleanText = text.replace(m[0], "").trim();
    }

    return res.json({ success: true, message: cleanText, usage, cost, action });
  } catch (e) {
    console.error("AI chat error:", e);
    return res.status(500).json({ success: false, message: "Error en el asistente" });
  }
}

function buildContextSummary(ctx) {
  const parts = [];
  const lat = ctx?.lat ?? ctx?.coords?.lat;
  const lng = ctx?.lng ?? ctx?.coords?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    parts.push(`Ubicación del usuario: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  } else {
    parts.push(`Sin ubicación del usuario (pídela solo si es necesaria).`);
  }
  const distance = ctx?.radius ?? ctx?.distance ?? ctx?.filters?.distance;
  if (typeof distance === "number") parts.push(`Radio: ${distance} m`);
  const category = ctx?.category ?? ctx?.filters?.category;
  if (category) parts.push(`Categoría: ${category}`);
  const openNow = ctx?.openNow ?? ctx?.filters?.openNow;
  if (typeof openNow === "boolean") parts.push(`Abierto ahora: ${openNow}`);
  if (ctx?.query) parts.push(`Consulta: "${ctx.query}"`);
  return parts.join(" | ");
}
