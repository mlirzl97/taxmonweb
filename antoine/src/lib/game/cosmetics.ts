/**
 * Your ant's wardrobe. Every player's ant uses Antoine's rig (09 §8) with
 * swappable parts. Free parts are always available; others are unlocked once
 * in the store and kept forever. Cosmetics never affect scoring.
 */
export type Slot = "body" | "hat" | "eyes" | "outfit" | "scarf" | "frame";

export type Look = { body: string; hat: string; eyes: string; outfit: string; scarf: string; frame: string };

export type Part = { id: string; slot: Slot; label: string; storeItem?: string; swatch?: string };

export const bodyColors: Record<string, { fill: string; shade: string; light: string; cheek: string }> = {
  red: { fill: "#e31e24", shade: "#b8191e", light: "#ff7478", cheek: "#ffb0b2" },
  ink: { fill: "#2b2b28", shade: "#1d1d1b", light: "#55554e", cheek: "#e98a8d" },
  bronze: { fill: "#9a5a2c", shade: "#7a4420", light: "#c47e4a", cheek: "#f0a58a" },
  gold: { fill: "#f0b429", shade: "#c98e0f", light: "#ffd66b", cheek: "#ff9a9d" },
};

export const scarfColors: Record<string, { fill: string; knot: string }> = {
  honey: { fill: "#f0b429", knot: "#d99a12" },
  red: { fill: "#e31e24", knot: "#b8191e" },
  sky: { fill: "#5b9bd5", knot: "#2f638d" },
  leaf: { fill: "#3f9a6a", knot: "#1f6b45" },
  cream: { fill: "#fffaf0", knot: "#e6dcc6" },
};

export const parts: Part[] = [
  { id: "red", slot: "body", label: "Ant red", swatch: "#e31e24" },
  { id: "ink", slot: "body", label: "Night", swatch: "#2b2b28" },
  { id: "bronze", slot: "body", label: "Bronze", swatch: "#9a5a2c" },
  { id: "gold", slot: "body", label: "Golden ant", swatch: "#f0b429", storeItem: "golden" },

  { id: "none", slot: "hat", label: "No hat" },
  { id: "cap", slot: "hat", label: "Office cap" },
  { id: "hardhat", slot: "hat", label: "Site visit hat" },
  { id: "balikbayan", slot: "hat", label: "Balikbayan cap", storeItem: "balikbayan" },
  { id: "salakot", slot: "hat", label: "Salakot", storeItem: "salakot" },

  { id: "none", slot: "eyes", label: "Bare eyes" },
  { id: "glasses", slot: "eyes", label: "Reading glasses" },
  { id: "shades", slot: "eyes", label: "Shades", storeItem: "shades" },

  { id: "scarf", slot: "outfit", label: "Scarf" },
  { id: "barong", slot: "outfit", label: "Homecoming barong", storeItem: "barong" },

  { id: "honey", slot: "scarf", label: "Honey", swatch: "#f0b429" },
  { id: "red", slot: "scarf", label: "Red", swatch: "#e31e24" },
  { id: "sky", slot: "scarf", label: "Sky", swatch: "#5b9bd5" },
  { id: "leaf", slot: "scarf", label: "Leaf", swatch: "#3f9a6a" },
  { id: "cream", slot: "scarf", label: "Cream", swatch: "#fffaf0" },

  { id: "none", slot: "frame", label: "Plain" },
  { id: "gold", slot: "frame", label: "Gold frame", storeItem: "frame" },
];

export const defaultLook: Look = { body: "red", hat: "none", eyes: "none", outfit: "scarf", scarf: "honey", frame: "none" };

export const slotLabels: Record<Slot, string> = { body: "Body", hat: "Hat", eyes: "Eyes", outfit: "Outfit", scarf: "Scarf", frame: "Frame" };

export function partFor(slot: Slot, id: string) {
  return parts.find((p) => p.slot === slot && p.id === id);
}

export function isUnlocked(part: Part, owned: ReadonlySet<string>) {
  return !part.storeItem || owned.has(part.storeItem);
}

/** A look is valid only when every part exists and is free or owned. */
export function lookErrors(look: Look, owned: ReadonlySet<string>): string | null {
  for (const slot of Object.keys(slotLabels) as Slot[]) {
    const part = partFor(slot, look[slot]);
    if (!part) return `Unknown ${slotLabels[slot].toLowerCase()} option.`;
    if (!isUnlocked(part, owned)) return `${part.label} is locked. Unlock it in the store first.`;
  }
  return null;
}

/** Store items that are cosmetics: bought once, kept forever. */
export const oneTimeItems = new Set(["frame", "barong", "title", "golden", "balikbayan", "salakot", "shades"]);
