import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  },
);

/** Simulated server latency for demo mode: kept short (max 120 ms) so the app feels instant; zero under test. */
export const wait = (ms: number) => (import.meta.env.MODE === "test" ? Promise.resolve() : new Promise((r) => setTimeout(r, Math.min(ms, 120))));

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) return err.response?.data?.detail ?? err.message ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}
