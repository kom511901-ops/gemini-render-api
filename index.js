// index.js — готовая версия для Render
// ✅ CORS (alexcontent.ru + dev localhost)
// ✅ /health (OK)
// ✅ /models (список моделей)
// ✅ /generate (генерация)
// ✅ можно передать model из фронта: body.model = "models/gemini-3-flash-preview" и т.п.
// ✅ нормальная обработка ошибок + таймаут

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// --------------------
// CORS (разрешаем запросы из браузера)
// --------------------
const ALLOWED_ORIGINS = new Set([
  "https://alexcontent.ru",
  "http://localhost:5173",
  "http://localhost:3000",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // если Origin есть и он разрешён — ставим его
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // чтобы CORS работал корректно при нескольких origin
  res.setHeader("Vary", "Origin");

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // preflight
  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});

// --------------------
// Helpers
// --------------------
function requireApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on Render");
  return key;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

// --------------------
// Routes
// --------------------
app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.send("OK"));

app.get("/models", async (req, res) => {
  try {
    const key = requireApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    const r = await fetchWithTimeout(url, {}, 30000);
    const data = await r.json().catch(() => ({}));

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "server error", details: e.message });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const key = requireApiKey();

    const { prompt, model, temperature, maxOutputTokens } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required (string)" });
    }

    // ✅ model можно передать с фронта:
    // "models/gemini-3-flash-preview" или "models/gemini-flash-latest"
    const chosenModel =
      typeof model === "string" && model.trim()
        ? model.trim()
        : "models/gemini-flash-latest";

    const url = `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${key}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        // необязательно, но удобно
        ...(typeof temperature === "number" ? { temperature } : {}),
        ...(typeof maxOutputTokens === "number" ? { maxOutputTokens } : {}),
      },
    };

    const r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      60000
    );

    const data = await r.json().catch(() => ({}));

    // если Gemini вернул ошибку — отдаём её как есть
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "server error", details: e.message });
  }
});

// --------------------
// Render PORT
// --------------------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server started on port " + port));
