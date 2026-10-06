import type { NavigationIcon } from "@/lib/navigation";

type IconProps = {
  name: NavigationIcon | "menu";
  size?: number;
};

export function Icon({ name, size = 18 }: IconProps) {
  const paths = {
    tower: <path d="M4 20h16M6 17V7l6-4 6 4v10M9 17v-5h6v5M12 3v9" />,
    work: <path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8M8 16h5" />,
    clients: <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 1 0 0-6M17 14h1a3 3 0 0 1 3 3v1" />,
    team: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20M16 4.5a3 3 0 0 1 0 5.8M17 14h.7a3.8 3.8 0 0 1 3.8 3.8V20" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };

  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </g>
    </svg>
  );
}
