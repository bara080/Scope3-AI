// src/pages/api/chat.ts
import { call } from "@/modules/agent";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = { message: string };

function getSessionId(req: NextApiRequest, res: NextApiResponse): string {
  const existing = req.cookies["session"];
  if (typeof existing === "string") return existing;

  const sessionId = randomUUID();
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax;${secure}`
  );
  return sessionId;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    res.status(404).json({ message: "Route not found" });
    return;
  }

  try {
    const { message } = JSON.parse(req.body || "{}");
    if (!message || typeof message !== "string") {
      res.status(400).json({ message: "Invalid message" });
      return;
    }

    const sessionId = getSessionId(req, res);
    const result = await call(message, sessionId);

    res.status(201).json({ message: result });
  } catch (e: any) {
    res.status(500).json({
      message: `I'm suffering from brain fog...\n\n${e?.message || e}`,
    });
  }
}
