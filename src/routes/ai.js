// backend/src/routes/ai.js

import express from "express";
import { authenticateJWT } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import { chatAssistant } from "../controllers/aiController.js";

const router = express.Router();

// Rate limit conservador para el chat
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,             // 10 req/min por IP
});

router.post("/chat", authenticateJWT, chatLimiter, chatAssistant);

export default router;
