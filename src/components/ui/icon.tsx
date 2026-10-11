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
    team: <>
      <path d="M12 4.5v3M12 7.5H6v3M12 7.5h6v3M6 10.5v3M18 10.5v3M6 13.5h12M6 13.5v4M12 13.5v4M18 13.5v4" />
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="6" cy="10.5" r="1.5" />
      <circle cx="18" cy="10.5" r="1.5" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </>,
    tax: <>
      <path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.1 2.1 4.9-5" />
    </>,
    bir: <path d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-5h6v5M9 9h.01M12 9h.01M15 9h.01" />,
    admin: <path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3ZM9 12h6M12 9v6" />,
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
