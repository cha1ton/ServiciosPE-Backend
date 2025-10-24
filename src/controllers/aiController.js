// backend/src/controllers/aiController.js

import { openrouterChat } from "../utils/openrouter.js";

const SYSTEM_PROMPT = `
Eres el asistente de ServiciosPE. Hablas español (Perú).
Tareas:
- Entender consultas en lenguaje natural sobre servicios cercanos (restaurantes, farmacias, etc.)
- Usar el contexto (ubicación y filtros) que te pasa el backend para redactar respuestas útiles.
- Explica por qué recomiendas algo y cómo filtras (si aplica).
- Si no hay coincidencias exactas, sugiere alternativas cercanas o categorías relacionadas.
- Sé breve y claro. Evita promesas técnicas (“haré X solicitud”), solo entrega respuesta al usuario.
- Si detectas intención de búsqueda, añade al FINAL de tu respuesta un bloque JSON en una sola línea con el formato exacto:
{"type":"search","q":"<opcional>","category":"<opcional>","distance":<numero>,"openNow":<true|false>}
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
