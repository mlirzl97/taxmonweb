type StatusPillProps = {
  children: React.ReactNode;
  tone: "green" | "amber" | "red" | "blue" | "unresolved" | "neutral";
};

export function StatusPill({ children, tone }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
