// backend/src/controllers/aiController.js

import { openrouterChat } from "../utils/openrouter.js";

const SYSTEM_PROMPT = `
Eres el asistente de ServiciosPE. Hablas español (Perú).

Tu único propósito es ayudar a encontrar negocios y servicios físicos cercanos
(restaurantes, pollerías, farmacias, veterinarias, ferreterías, talleres, hoteles, parques, etc.)
a partir de lo que el usuario pide.

Reglas importantes:

1) DOMINIO LIMITADO
- Si el usuario pregunta definiciones o conceptos generales
  (por ejemplo: "qué es python", "qué es el IGV", "qué es un FODA", "para qué sirve X"),
  responde SOLO con una frase breve del tipo:
  "Solo puedo ayudarte a encontrar negocios y lugares cercanos (restaurantes, farmacias, veterinarias, etc.)."
- En esos casos NO generes ningún JSON de búsqueda.
- Ignora preguntas teóricas, escolares o de programación que no estén relacionadas con ir a un lugar.

2) INTENCIÓN DE BÚSQUEDA
- Cuando el usuario pida algo que implique ir a un lugar físico
  ("tengo hambre", "pollería cerca", "veterinaria para mi perro", "top 3 cevicherías"),
  tu trabajo es decidir si hay intención de búsqueda y, si la hay, devolver
  un bloque JSON al final para que el backend haga la búsqueda real.

3) JSON DE ACCIÓN
- Si detectas intención de búsqueda, añade al FINAL de tu respuesta un bloque JSON en una sola línea con el formato exacto:
{"type":"search","q":"<opcional>","category":"<opcional>","distance":<numero>,"openNow":<true|false>}
- "q" debe ser una frase corta que ayude a refinar (por ejemplo "cevichería", "pollería", "farmacia 24 horas").
- "category" puede ser una categoría estándar (por ejemplo "restaurant", "pharmacy", "veterinary_care", "hardware_store", "hotel", "park").
- "distance" debe ser un número en metros. Usa un valor razonable (por ejemplo 500, 800, 1200).
- "openNow" normalmente será false salvo que el usuario diga claramente que quiere "abierto ahora" o "de madrugada".

4) ESTILO
- Sé breve y claro en tus mensajes.
- Tolera faltas ortográficas ("trizte" → "triste", etc.).
- No describas datos concretos de negocios (nombre, distancia, rating), porque eso lo arma la interfaz con datos reales.
- Cuando devuelvas JSON, evita añadir texto después del JSON. El JSON debe ir al final.
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
