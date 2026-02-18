import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://alexcontent.ru");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // если браузер прислал "проверку" (OPTIONS) — отвечаем сразу
  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});


app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/generate", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "server error", details: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server started on port " + port);
});

