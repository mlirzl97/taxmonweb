export const primaryNavigation = [
  { href: "/app/control-tower", label: "Control Tower", icon: "tower" },
  { href: "/app/my-work", label: "My Work", icon: "work" },
  { href: "/app/clients", label: "Clients", icon: "clients" },
  { href: "/app/team", label: "Team", icon: "team" },
] as const;

export type NavigationIcon = (typeof primaryNavigation)[number]["icon"];
