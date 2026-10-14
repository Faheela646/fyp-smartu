import type { Bus, TransportRoute } from "@/types/api";
import { useDemoDB } from "@/demo/db";
import { DEMO_MODE } from "./wsClient";
import { http, wait } from "./http";

export const transportService = {
  async listRoutes(): Promise<TransportRoute[]> {
    if (DEMO_MODE) {
      await wait(60);
      return useDemoDB.getState().routes;
    }
    return (await http.get<TransportRoute[]>("/routes")).data;
  },
  async listBuses(): Promise<Bus[]> {
    if (DEMO_MODE) {
      await wait(40);
      return useDemoDB.getState().buses;
    }
    return (await http.get<Bus[]>("/buses")).data;
  },
};
