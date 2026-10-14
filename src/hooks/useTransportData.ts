import { useQuery } from "@tanstack/react-query";
import { transportService } from "@/services/transport";

export const useRoutes = () => useQuery({ queryKey: ["routes"], queryFn: transportService.listRoutes });
export const useBuses = () => useQuery({ queryKey: ["buses"], queryFn: transportService.listBuses });
