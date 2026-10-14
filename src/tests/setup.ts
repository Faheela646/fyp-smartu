import { beforeEach } from "vitest";
import { useDemoDB } from "@/demo/db";
import { DEMO_BUSES } from "@/demo/data";
import { simulator } from "@/demo/simulator";
import { useAuthStore } from "@/store/auth";
import { ADMIN } from "./helpers";

/** Every test starts from the same seeded database, a known bus load, and an admin session. */
beforeEach(() => {
  useDemoDB.getState().reset();
  useAuthStore.setState({ user: ADMIN, token: "test" });
  DEMO_BUSES.forEach((b) => {
    const live = simulator.getSeats(b.id)!;
    simulator.adjustSeats(b.id, 20 - live.seatsAvailable, "seat");
    simulator.adjustSeats(b.id, 10 - simulator.getSeats(b.id)!.standingAvailable, "standing");
    simulator.setTrip(b.id, true);
  });
});
