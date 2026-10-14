import type { Bus, Stop, TransportRoute, User } from "@/types/api";
import { UNI_ROUTES } from "./uniRoutes";

/**
 * Routes, stops, timings and authorised persons come from the university's
 * "Complete Buses Route FALL-2026" timetable.
 *
 * The timetable has place names and times but no GPS coordinates, so stop positions
 * on the map are SCHEMATIC: each stop is placed along a fan-out line from the campus,
 * at a distance proportional to its travel time. Admins can enter real coordinates per
 * stop under Routes, and conductors' live GPS replaces the simulation anyway.
 */
export const CAMPUS: [number, number] = [31.5197, 72.9701];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const CAMPUS_ARRIVAL = 8 * 60 + 25;
const KM_PER_MIN = 0.2;

function colorFor(i: number) {
  const hue = Math.round((i * 360) / UNI_ROUTES.length + 215) % 360;
  return `hsl(${hue} 62% 38%)`;
}

function buildRoute(u: (typeof UNI_ROUTES)[number], index: number): TransportRoute {
  const id = `R${u.number}`;
  // Chiniot route heads north; city routes fan out across the south-east half-plane.
  const city = UNI_ROUTES.filter((r) => r.note !== "Chiniot");
  const cityIdx = city.findIndex((r) => r.number === u.number);
  const theta = u.note === "Chiniot" ? 20 : 95 + (cityIdx * 150) / Math.max(1, city.length - 1);
  const rad = (theta * Math.PI) / 180;
  const stops: Stop[] = u.stops.map((s, i) => {
    const isCampus = s.name.toLowerCase() === "campus";
    const dist = isCampus ? 0 : Math.max(0.4, (CAMPUS_ARRIVAL - toMin(s.time)) * KM_PER_MIN);
    const wobble = Math.sin(i * 1.7 + index) * 0.12 * dist; // keep lines from being perfectly straight
    const lat = CAMPUS[0] + (dist * Math.cos(rad)) / 111 + (wobble * Math.sin(rad)) / 111;
    const lng = CAMPUS[1] + (dist * Math.sin(rad)) / (111 * Math.cos((CAMPUS[0] * Math.PI) / 180)) - (wobble * Math.cos(rad)) / 111;
    return { id: `${id}-S${i + 1}`, name: isCampus ? "Campus" : s.name, lat: +lat.toFixed(5), lng: +lng.toFixed(5), time: s.time };
  });
  const first = stops[0].name;
  return {
    id,
    number: u.number,
    name: `Route ${u.number}`,
    via: `${first} → Campus`,
    note: u.note ?? undefined,
    contact: u.contact ?? undefined,
    color: colorFor(index),
    stops,
    path: stops.map((s) => [s.lat, s.lng] as [number, number]),
    approxGeometry: true,
  };
}

export const DEMO_ROUTES: TransportRoute[] = UNI_ROUTES.map(buildRoute);

const PLATE_LETTERS = ["LEA", "LEB", "LEC", "FDA", "FDB", "LED"];
export const DEMO_BUSES: Bus[] = DEMO_ROUTES.map((r, i) => ({
  id: `B${r.number}`,
  plate: `${PLATE_LETTERS[i % PLATE_LETTERS.length]}-${String(1000 + ((i * 337) % 9000)).padStart(4, "0")}`,
  routeId: r.id,
  seatCapacity: 36 + (i % 4) * 4,
  standingCapacity: 10 + (i % 3) * 2,
}));

export const busForRoute = (routeId: string) => DEMO_BUSES.find((b) => b.routeId === routeId);

export interface DemoAccount extends User {
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: "U-ADMIN", identifier: "transport.office", email: "transport.office@cfd.nu.edu.pk", password: "admin123", name: "Transport Office", role: "ADMIN" },
  { id: "U-3082", identifier: "22F-3082", email: "f223082@cfd.nu.edu.pk", password: "3082@fast", name: "Ayesha Khan", role: "DAY_SCHOLAR", routeId: "R01" },
  { id: "U-3091", identifier: "22F-3091", email: "f223091@cfd.nu.edu.pk", password: "3091@fast", name: "Hamza Ali", role: "HOSTELITE", routeId: "R05" },
  { id: "U-COND1", identifier: "rashid.mehmood", email: "rashid.mehmood@cfd.nu.edu.pk", password: "conductor123", name: "Rashid Mehmood", role: "CONDUCTOR", routeId: "R01" },
];
