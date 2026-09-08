import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { generateSkillResponse } from "./server/gemini.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MODELS = ["gemini-3.8-flash"] as const;

const generateRequestSchema = z.object({
  model: z.enum(ALLOWED_MODELS),
  message: z.string().min(1).max(20000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        parts: z.array(z.object({ text: z.string().max(20000) })),
      })
    )
    .max(200),
});

async function startServer() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error("GOOGLE_CLOUD_PROJECT environment variable must be set");
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/generate", async (req, res) => {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    try {
      const { model, history, message } = parsed.data;
      const text = await generateSkillResponse(model, history, message);
      res.json({ text });
    } catch (err: any) {
      console.error("Gemini generation error:", err);
      res.status(500).json({ error: "An internal server error occurred" });
    }
  });

  // Vite middleware for development (imported dynamically so the dev-only
  // `vite` package doesn't need to be installed in the production runtime image).
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
