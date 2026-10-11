export const primaryNavigation = [
  { href: "/app/control-tower", label: "Control Tower", icon: "tower" },
  { href: "/app/team", label: "Team", icon: "team" },
  { href: "/app/clients", label: "Clients", icon: "clients" },
  { href: "/app/work", label: "Work", icon: "work" },
  { href: "/app/bir-center", label: "BIR Center", icon: "bir" },
  { href: "/app/admin", label: "Admin", icon: "admin" },
] as const;

// Tax Team is a restricted control view over shared work, not a seventh public workspace.
// Keep it separate so the primary product grammar remains stable while authorized personas
// can still reach their control surface directly from the shell.
export const restrictedNavigation = [
  { href: "/app/tax-team", label: "Tax Team", icon: "tax" },
] as const;

export type NavigationIcon = (typeof primaryNavigation | typeof restrictedNavigation)[number]["icon"];
