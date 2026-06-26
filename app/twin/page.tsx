"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PressButton } from "@/components/ui/Animate";

type Message = { role: "user" | "twin"; content: string };

export default function TwinPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [twinStyle, setTwinStyle] = useState("Shadow Twin");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = localStorage.getItem("oraculum.activeSessionId");
    if (!sid) return;
    setSessionId(sid);

    fetch(`/api/talent-profile?session_id=${sid}`)
      .then(r => r.json())
      .then(data => {
        const profile = data?.talentProfile;
        if (profile) {
          setHasProfile(true);
          setTwinStyle(profile.dominant_style ?? "Shadow Twin");
          setMessages([{
            role: "twin",
            content: `I am your ${profile.dominant_style ?? "Shadow Twin"}. I have studied ${Object.keys(profile.dimension_scores ?? {}).length} dimensions of how we think. ${profile.summary_text ? profile.summary_text.split(".")[0] + "." : ""} Query my matrices.`
          }]);
        } else {
          setMessages([{
            role: "twin",
            content: "Matrix incomplete. Complete the primary cognitive sequence first."
          }]);
        }
      })
      .catch(() => {
        setMessages([{ role: "twin", content: "Establishing connection..." }]);
      });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isSending]);

  // No session
  if (!sessionId && typeof window !== "undefined") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center min-h-[70vh] bg-grid">
        <h1 className="text-2xl font-serif text-parchment uppercase tracking-widest">Interface Offline</h1>
        <p className="text-parchment-dim font-sans max-w-md">
          Complete the cognitive sequence to activate the Shadow Twin interface.
        </p>
        <Link href="/challenges" className="btn-amber px-8 py-3 text-sm uppercase tracking-widest mt-4">
          Initiate Sequence
        </Link>
      </div>
    );
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    const updated: Message[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text, history: updated.slice(-8) })
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "twin", content: data.response || data.error || "..." }]);
    } catch {
      setMessages(p => [...p, { role: "twin", content: "Connection fragmented. Retry transmission." }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col bg-grid" style={{ height: "calc(100vh - 80px)" }}>

      {/* Header */}
      <div className="flex items-center justify-between py-4 shrink-0 border-b border-parchment-faint mb-4">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-jade pulse-amber" />
            <h1 className="text-[10px] font-mono text-jade tracking-[0.3em] uppercase">Secure Link Active</h1>
          </div>
          <p className="text-2xl font-serif text-parchment">{twinStyle}</p>
        </div>
        {!hasProfile && (
          <Link href="/challenges" className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase hover:text-white transition">
            [ Incomplete Matrix — Assess ]
          </Link>
        )}
      </div>

      {/* Chat window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-panel/30 border border-parchment-faint mb-4 relative">
        <div className="absolute top-0 right-0 bg-obsidian px-2 py-1 text-[8px] font-mono text-parchment-dim uppercase border-l border-b border-parchment-faint">
          Twin_Terminal_v1
        </div>
        
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] p-4 border text-sm font-sans leading-relaxed ${
                m.role === "user"
                  ? "bg-obsidian border-parchment-faint text-parchment"
                  : "bg-amber/5 border-amber/30 text-parchment-dim border-l-2 border-l-amber/60"
              }`}>
                {m.role === "twin" && (
                  <p className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase mb-2">{twinStyle}</p>
                )}
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isSending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-amber/5 border border-amber/30 p-4 border-l-2 border-l-amber/60">
              <p className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase mb-2">{twinStyle}</p>
              <div className="flex gap-2 items-center h-4">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-amber"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-4 shrink-0 pb-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Transmit query..."
          className="oracle-input flex-1 p-4 text-sm font-mono tracking-wide"
        />
        <PressButton
          type="submit"
          disabled={!input.trim() || isSending}
          className="btn-amber px-8 py-4 text-xs font-mono uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          [ TX ]
        </PressButton>
      </form>
    </div>
  );
}
