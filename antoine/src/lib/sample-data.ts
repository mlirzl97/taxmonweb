/**
 * SAMPLE DATA ONLY. Every client and person here is fictional, and every date
 * is illustrative. No Philippine tax content is asserted. This module is
 * replaced by live reads from TaxMonWeb's verified work facts once the Colony
 * tables and shadow scoring exist (08 §9, Lego G1). It must never be used
 * with real client data.
 */

export const SAMPLE = true;

export const cycle = {
  label: "Nov cycle",
  anay: { hp: 18, maxHp: 41, hits: 23, heals: 2, workingDaysLeft: 9, nextD1: "Wed 11 Nov" },
  rings: { filed: [23, 41], evidence: [19, 23], qa: [6, 6] },
  chambers: { done: ["SEP", "OCT"], digging: "NOV", progress: "23/41" },
  late: 2,
};

export type Player = { name: string; initials: string; f: number; s: number; e: number; st: number; move: number; clean: number; cup: number; hall: number; me?: boolean };

export const players: Player[] = [
  { name: "Mika Reyes", initials: "MR", f: 980, s: 260, e: 0, st: 180, move: 0, clean: 98, cup: 2.6, hall: 22 },
  { name: "Paolo Dizon", initials: "PD", f: 450, s: 640, e: 220, st: 0, move: 1, clean: 95, cup: 3.1, hall: 19 },
  { name: "Jas Ramos", initials: "JR", f: 0, s: 380, e: 800, st: 0, move: -1, clean: 100, cup: 2.9, hall: 30 },
  { name: "Rina Cruz", initials: "RC", f: 760, s: 290, e: 0, st: 0, move: 2, clean: 92, cup: 2.4, hall: 12 },
  { name: "Carlo Lim", initials: "CL", f: 300, s: 0, e: 0, st: 680, move: -1, clean: 96, cup: 3.3, hall: 26 },
  { name: "Bea Santos", initials: "BS", f: 820, s: 120, e: 0, st: 0, move: 3, clean: 97, cup: 2.2, hall: 5, me: true },
  { name: "Toni Garcia", initials: "TG", f: 905, s: 0, e: 0, st: 0, move: -2, clean: 90, cup: 2.7, hall: 9 },
  { name: "Ivy Torres", initials: "IT", f: 520, s: 300, e: 0, st: 0, move: 1, clean: 94, cup: 2.5, hall: 14 },
  { name: "Nico Bautista", initials: "NB", f: 0, s: 210, e: 560, st: 0, move: 0, clean: 99, cup: 3.0, hall: 24 },
  { name: "Dana Flores", initials: "DF", f: 410, s: 0, e: 0, st: 290, move: -1, clean: 93, cup: 2.8, hall: 16 },
];

export const rankTiers = ["Larva", "Worker Ant", "Forager", "Tunneler", "Soldier Ant", "Scout Captain", "Colony Elder", "Colony Keeper"] as const;
export const rankFloors = [0, 500, 1500, 4000, 8000, 15000, 30000, 60000] as const;

export type StoreItem = { id: string; label: string; price: number; kind: "digital" | "real"; tint: string; blurb?: string };

export const storeItems: StoreItem[] = [
  { id: "freeze", label: "Streak freeze", price: 300, kind: "digital", tint: "#dff1f7", blurb: "Protects your clean streak through one leave week." },
  { id: "balikbayan", label: "Balikbayan cap", price: 700, kind: "digital", tint: "#e8e2f4", blurb: "Straight from the New York days." },
  { id: "shades", label: "Shades", price: 500, kind: "digital", tint: "#efe3c8", blurb: "For when the deadline is sunny-side up." },
  { id: "salakot", label: "Salakot", price: 900, kind: "digital", tint: "#f2e6c9", blurb: "Classic. Shade for long filing seasons." },
  { id: "barong", label: "Homecoming barong", price: 1200, kind: "digital", tint: "#fbf3dc", blurb: "Antoine's balikbayan best." },
  { id: "golden", label: "Golden ant", price: 2000, kind: "digital", tint: "#fbe9c4", blurb: "A whole golden body. Rare." },
  { id: "frame", label: "Gold profile frame", price: 800, kind: "digital", tint: "#fbe9c4", blurb: "A gold ring around your avatar." },
  { id: "title", label: "Title · Deadline Slayer", price: 600, kind: "digital", tint: "#f6d5d2", blurb: "Shown under your name." },
  { id: "gc", label: "Gift certificate ₱100", price: 10000, kind: "real", tint: "#e3f1e8", blurb: "Handed over by Lourdes." },
  { id: "perk", label: "[Committee perk placeholder]", price: 25000, kind: "real", tint: "#ece6f2", blurb: "Waiting for the committee to approve." },
];

export const pendingOrder = "Culture & Values mug · 1,000 Ants";
export const storeName = "Culture & Values Store";
export const storeManager = "Lourdes";
