import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["Are there seats on my route?", "When does my bus arrive?", "How long is my QR valid?", "Do I have any dues?"];

export function ChatBody({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)!;
  const { messages, typing, send, clear } = useChatStore();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  const submit = (t: string) => {
    if (!t.trim()) return;
    setText("");
    send(t.trim(), user);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed", m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>{m.text}</p>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start" aria-label="Assistant is typing">
            <div className="flex gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-2 w-2 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => submit(s)} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-primary-soft hover:text-primary">
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex items-center gap-2 border-t border-border p-3">
        <button type="button" onClick={clear} className="rounded-md p-2.5 text-muted-foreground hover:bg-muted" aria-label="Clear conversation"><Trash2 className="h-5 w-5" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about seats, ETA, fees…" aria-label="Message" className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-base" />
        <Button type="submit" size="icon" className="rounded-full" disabled={typing || !text.trim()} aria-label="Send"><Send className="h-5 w-5" /></Button>
      </form>
    </div>
  );
}

/** Floating assistant (bottom-right). */
export function ChatWidget() {
  const { open, setOpen } = useChatStore();
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="SmartU assistant"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-24 z-[1150] flex h-[min(560px,70vh)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-raised sm:inset-x-auto sm:right-6 sm:w-[400px] lg:bottom-24"
          >
            <header className="flex items-center justify-between bg-gradient-to-r from-[#14307A] to-[#1D4ED8] px-4 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20"><Bot className="h-5 w-5" /></span>
                <div>
                  <p className="font-bold leading-tight">SmartU Assistant</p>
                  <p className="text-xs text-white/80">Online · answers from live data</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-white/15" aria-label="Close assistant"><X className="h-5 w-5" /></button>
            </header>
            <ChatBody className="flex-1" />
          </motion.section>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-24 right-4 z-[1150] grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform hover:scale-105 active:scale-95 sm:right-6 lg:bottom-6"
        style={{ display: open ? "none" : undefined }}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </>
  );
}
