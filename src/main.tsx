import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "@/app/App";
import { useThemeStore } from "@/store/theme";
import "leaflet/dist/leaflet.css";
import "@/styles/globals.css";
import { simulator } from "@/demo/simulator";

// Dev-only handle so a demo/test can force scenarios (e.g. a full bus) from the console.
if (import.meta.env.DEV) (window as unknown as { __sim: typeof simulator }).__sim = simulator;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function ThemedToaster() {
  const theme = useThemeStore((s) => s.theme);
  return <Toaster theme={theme} position="top-right" closeButton richColors />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
