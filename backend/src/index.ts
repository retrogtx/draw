import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import type { RequestHandler } from "express";

const app = express();
app.use(express.json());
app.use(cors());

// A temporary in-memory store for session data.
// In a production environment, you would use a database or a service like Redis.
const sessions: Record<string, { id: string; participants: any[]; }> = {};

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Endpoint to create a new drawing session.
app.post("/sessions", (req, res) => {
  const sessionId = nanoid();
  sessions[sessionId] = {
    id: sessionId,
    participants: [],
  };
  res.status(201).json({ sessionId });
});

// Endpoint to get session metadata.
const getSessionHandler: RequestHandler = (req, res) => {
  const { id } = req.params as { id?: string };

  if (!id) {
    res.status(400).json({ message: "Missing session id" });
    return;
  }

  const session = sessions[id];

  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  res.json({
    participants: session.participants,
    lastUpdated: new Date().toISOString(), // This is just a placeholder
  });
};

app.get("/sessions/:id", getSessionHandler);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
