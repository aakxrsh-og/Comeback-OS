const MAX_BODY = 12_000;
const MAX_PROMPT = 8_000;

const corsHeaders = (origin, env) => {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
  const permitted = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": permitted ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
};

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return json({ ok: true, service: "comeback-os-ai", providerConfigured: Boolean(env.GEMINI_API_KEY) }, 200, cors);
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/api/mentor") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (!origin || cors["Access-Control-Allow-Origin"] === "null") {
      return json({ error: "Origin not allowed" }, 403, cors);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: "AI provider is not configured on the backend." }, 503, cors);
    }

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > MAX_BODY) return json({ error: "Request too large." }, 413, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON." }, 400, cors); }

    const prompt = typeof body?.message === "string" ? body.message.trim() : "";
    if (!prompt || prompt.length > MAX_PROMPT) {
      return json({ error: `Message must contain 1–${MAX_PROMPT} characters.` }, 400, cors);
    }

    // Send only the current prompt and small, non-sensitive study context.
    const context = typeof body?.studyContext === "string"
      ? body.studyContext.slice(0, 2500)
      : "";

    const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    let upstream;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                "You are The System, a calm, practical JEE study mentor for a teenage student.",
                "Help with learning, planning, explanations, revision and study reflection.",
                "Be encouraging without pressure, shame, threats, or claims that exam results define a person's worth.",
                "Never ask for passwords, API keys, addresses, or other sensitive personal information.",
                "Do not invent syllabus facts, answer keys, marks, or mastery evidence.",
                "When uncertain, say so and recommend checking an official syllabus or trusted teacher.",
                "Keep answers age-appropriate and focused on education."
              ].join(" ")
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: context ? `Study context (unverified user-entered data):\n${context}\n\nRequest:\n${prompt}` : prompt }]
          }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
            responseMimeType: "text/plain"
          }
        }),
      });
    } catch {
      return json({ error: "Could not reach the AI provider. Try again later." }, 502, cors);
    }

    const raw = await upstream.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}
    if (!upstream.ok) {
  const providerError = data?.error || {};
  const safeMessage = typeof providerError.message === "string"
    ? providerError.message.slice(0, 250)
    : "No provider message";

  console.error("Gemini API rejected request", {
    httpStatus: upstream.status,
    status: providerError.status || "unknown",
    message: safeMessage
  });

  return json({
    error: `Gemini error (${upstream.status}): ${safeMessage}`
  }, 502, cors);
    }    const reply = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "").join("").trim();
    if (!reply) return json({ error: "The AI provider returned an empty response." }, 502, cors);
    return json({ reply, model: data.modelVersion || model }, 200, cors);
  },
};
