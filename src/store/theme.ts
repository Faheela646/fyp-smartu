import { create } from "zustand";

type Theme = "light" | "dark";

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("smartu-theme", t);
  } catch {
    /* storage unavailable */
  }
}

export const useThemeStore = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: (document.documentElement.dataset.theme as Theme) || "light",
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
}));
