type AntMarkProps = {
  size?: number;
  inverted?: boolean;
  className?: string;
};

export function AntMark({ size = 48, inverted = false, className }: AntMarkProps) {
  const red = inverted ? "#ffffff" : "#e31e24";
  const classNames = ["ant-mark", className].filter(Boolean).join(" ");

  return (
    <svg
      aria-hidden="true"
      className={classNames}
      fill="none"
      height={size}
      viewBox="0 0 100 100"
      width={size}
    >
      <g fill={red} stroke={red} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="29" cy="68" rx="20" ry="15" strokeWidth="2" />
        <circle cx="54" cy="53" r="14" strokeWidth="2" />
        <circle cx="75" cy="34" r="11" strokeWidth="2" />
        <path d="M75 23 83 11M78 22 91 20" fill="none" strokeWidth="4" />
        <path d="M49 62 37 82M56 64 52 87M62 60 74 79M36 57 20 48M42 48 30 33M65 42 83 47" fill="none" strokeWidth="5" />
      </g>
    </svg>
  );
}
