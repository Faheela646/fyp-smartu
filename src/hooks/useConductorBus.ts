import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useAuthStore } from "@/store/auth";

/** The bus/route assigned to the signed-in conductor. */
export function useAssignedBus() {
  const user = useAuthStore((s) => s.user)!;
  const buses = useBuses();
  const routes = useRoutes();
  const bus = buses.data?.find((b) => b.routeId === user.routeId) ?? buses.data?.[0];
  const route = routes.data?.find((r) => r.id === bus?.routeId);
  return { user, bus, route, loading: buses.isLoading || routes.isLoading };
}
