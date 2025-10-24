// backend/src/utils/openrouter.js

import fetch from "node-fetch";

const MODEL = "deepseek/deepseek-v3.2-exp";

// Guardarraíles MVP
const MAX_TOKENS = 600;          // límite por respuesta
const TIMEOUT_MS = 15000;        // 15s
const TEMP = 0.6;
const TOP_P = 1;

// Precios aprox (pueden cambiar)
const PRICE_IN_PER_M = 0.27;     // USD por 1M tokens input
const PRICE_OUT_PER_M = 0.40;    // USD por 1M tokens output

export async function openrouterChat({
  messages,
  systemPrompt,
  extraHeaders = {},
}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Mensaje de sistema claro (es-PE)
  const finalMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Trunca historial simple (últimos 12 mensajes máx)
  const MAX_HISTORY = 12;
  const compactMessages = [
    finalMessages[0], // system
    ...finalMessages.slice(-MAX_HISTORY),
  ];

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "ServiciosPE Chatbot",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMP,
        top_p: TOP_P,
        max_tokens: MAX_TOKENS,
        messages: compactMessages,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`OpenRouter ${resp.status}: ${text || resp.statusText}`);
    }

    const data = await resp.json();

    // usage tokens (OpenAI-compat)
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // cálculo costo aprox
    const costIn  = (usage.prompt_tokens / 1_000_000) * PRICE_IN_PER_M;
    const costOut = (usage.completion_tokens / 1_000_000) * PRICE_OUT_PER_M;
    const costTotal = +(costIn + costOut).toFixed(6);

    const text = data.choices?.[0]?.message?.content?.trim() || "Lo siento, no pude generar respuesta.";

    return {
      ok: true,
      text,
      usage,
      cost: { in: costIn, out: costOut, total: costTotal },
    };
  } catch (e) {
    return { ok: false, error: e.message || "Error llamando al modelo" };
  } finally {
    clearTimeout(t);
  }
}
