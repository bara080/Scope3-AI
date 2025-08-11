// src/app/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Msg = { role: "user" | "ai"; content: string };

export default function Chat() {
  const [msg, setMsg] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      content:
        process.env.NEXT_PUBLIC_CHATBOT_GREETING || "How can I help you today?",
    },
  ]);

  async function send(m: string) {
    setMessages((x) => [...x, { role: "user", content: m }]);
    setThinking(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: m }),
      });
      const json = (await r.json()) as { message: string };
      setMessages((x) => [...x, { role: "ai", content: json.message }]);
    } catch (e: any) {
      setMessages((x) => [
        ...x,
        { role: "ai", content: `Error: ${e?.message || String(e)}` },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Card className="h-[80vh] flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="px-4 py-3 border-b text-sm text-muted-foreground">
            <span className="font-semibold">
              {process.env.NEXT_PUBLIC_CHATBOT_NAME || "Chatbot"}
            </span>{" "}
            — {process.env.NEXT_PUBLIC_CHATBOT_DESCRIPTION || "Assistant"}
          </div>

          <ScrollArea className="flex-1 p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "ai"
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground ml-auto"
                }`}
              >
                {m.content}
              </div>
            ))}
            {thinking && (
              <div className="w-28 h-6 rounded-lg bg-muted animate-pulse" />
            )}
          </ScrollArea>

          <form
            className="flex gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = msg.trim();
              if (!value) return;
              setMsg("");
              void send(value);
            }}
          >
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Type your message…"
              autoFocus
            />
            <Button type="submit" disabled={thinking}>
              {thinking ? "Thinking…" : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
