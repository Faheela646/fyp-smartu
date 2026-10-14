import { create } from "zustand";
import { streamReply } from "@/services/chat";
import type { User } from "@/types/api";

export interface ChatMsg {
  id: string;
  role: "user" | "bot";
  text: string;
}

interface ChatState {
  open: boolean;
  messages: ChatMsg[];
  typing: boolean;
  setOpen: (o: boolean) => void;
  send: (text: string, user: User) => Promise<void>;
  clear: () => void;
}

const greeting: ChatMsg = { id: "g", role: "bot", text: "Hi! I'm the SmartU assistant. Ask me about live seats, bus ETA, booking, cancellations, fees or fines." };

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  messages: [greeting],
  typing: false,
  setOpen: (open) => set({ open }),
  clear: () => set({ messages: [greeting] }),
  send: async (text, user) => {
    if (get().typing || !text.trim()) return;
    const uid = `u${Date.now()}`;
    const bid = `b${Date.now()}`;
    set((s) => ({ messages: [...s.messages, { id: uid, role: "user", text }], typing: true }));
    try {
      let first = true;
      for await (const chunk of streamReply(text, user)) {
        if (first) {
          first = false;
          set((s) => ({ typing: false, messages: [...s.messages, { id: bid, role: "bot", text: chunk }] }));
        } else {
          set((s) => ({ messages: s.messages.map((m) => (m.id === bid ? { ...m, text: m.text + chunk } : m)) }));
        }
      }
    } catch {
      set((s) => ({ typing: false, messages: [...s.messages, { id: bid, role: "bot", text: "Sorry, I couldn't reach the assistant. Please try again." }] }));
    } finally {
      set({ typing: false });
    }
  },
}));
