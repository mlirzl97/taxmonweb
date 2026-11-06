/** Status is never colour alone: every tone has its own shape. */
export function StatusIcon({ tone }: { tone: "blocked" | "risk" | "ok" }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
      {tone === "blocked" && <><circle cx={12} cy={12} r={9} /><path d="M5.6 5.6l12.8 12.8" /></>}
      {tone === "risk" && <><circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 2" /></>}
      {tone === "ok" && <path d="M4 12l5 5L20 6" />}
    </svg>
  );
}

export function AntCoin({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={10} fill="#f0b429" stroke="#1d1d1b" strokeWidth={2} />
      <circle cx={8.6} cy={12} r={2} fill="#1d1d1b" />
      <circle cx={12.6} cy={12} r={1.6} fill="#1d1d1b" />
      <circle cx={16.2} cy={12} r={2} fill="#1d1d1b" />
    </svg>
  );
}

export function BackIcon() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>;
}
