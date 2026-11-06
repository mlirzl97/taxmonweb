/** Anay — the fictional termite villain (style B; 09 §8.3). Cartoon, never scary. */
export type AnayMood = "angry" | "smug" | "defeated";

const labels: Record<AnayMood, string> = {
  angry: "Anay the termite, angry",
  smug: "Anay the termite, looking smug",
  defeated: "Anay the termite, defeated",
};

const INK = "#1d1d1b";
const LEGS = "M58 160 L34 152 L22 164 M56 176 L34 186 L28 200 M66 192 L54 206 M142 160 L166 152 L178 164 M144 176 L166 186 L172 200 M134 192 L146 206";

export function Anay({ mood = "angry", size = 200, className }: { mood?: AnayMood; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={Math.round((size * 228) / 232)} viewBox="-16 -8 232 228" fill="none" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={labels[mood]}>
      <g fill="#fff" stroke="#fff">
        <path d="M72 44 L60 22 L44 16 M128 44 L140 22 L156 16" fill="none" strokeWidth={18} />
        <circle cx={44} cy={16} r={13} />
        <circle cx={156} cy={16} r={13} />
        <path d={LEGS} fill="none" strokeWidth={22} />
        <ellipse cx={100} cy={168} rx={60} ry={44} stroke="none" />
        <ellipse cx={100} cy={90} rx={67} ry={60} stroke="none" />
        <path d="M82 128 C66 140 66 162 84 168 M118 128 C134 140 134 162 116 168" fill="none" strokeWidth={22} />
      </g>
      <path d="M72 44 L60 22 L44 16 M128 44 L140 22 L156 16" stroke={INK} strokeWidth={6} />
      <g fill="#7a3e17" stroke={INK} strokeWidth={3}>
        <circle cx={60} cy={22} r={5} /><circle cx={44} cy={16} r={6.5} />
        <circle cx={140} cy={22} r={5} /><circle cx={156} cy={16} r={6.5} />
      </g>
      <path d={LEGS} stroke={INK} strokeWidth={8} />
      <ellipse cx={100} cy={168} rx={51} ry={35} fill="#f3dfb4" stroke={INK} strokeWidth={5} />
      <path d="M60 162 Q100 176 140 162 M58 178 Q100 194 142 178 M68 192 Q100 205 132 192" stroke="#c9a46b" strokeWidth={4} />
      <ellipse cx={76} cy={152} rx={12} ry={5} fill="#fff6dd" transform="rotate(-12 76 152)" />
      <ellipse cx={100} cy={90} rx={58} ry={51} fill="#c8702f" stroke={INK} strokeWidth={5} />
      <ellipse cx={72} cy={62} rx={16} ry={7} fill="#e3914f" transform="rotate(-25 72 62)" />
      <path d="M82 128 C66 140 66 162 84 168 C80 156 82 146 92 138 Z" fill="#5a2e14" stroke={INK} strokeWidth={4} />
      <path d="M118 128 C134 140 134 162 116 168 C120 156 118 146 108 138 Z" fill="#5a2e14" stroke={INK} strokeWidth={4} />
      <path d="M74 144 C73 150 74 156 77 160 M126 144 C127 150 126 156 123 160" stroke="#8a4a24" strokeWidth={2.5} />
      {mood === "angry" && (
        <>
          <ellipse cx={78} cy={91} rx={15} ry={11} fill="#fff" stroke={INK} strokeWidth={3.5} transform="rotate(14 78 91)" />
          <ellipse cx={122} cy={91} rx={15} ry={11} fill="#fff" stroke={INK} strokeWidth={3.5} transform="rotate(-14 122 91)" />
          <circle cx={81} cy={94} r={6} fill={INK} /><circle cx={119} cy={94} r={6} fill={INK} />
          <circle cx={83} cy={91.5} r={1.8} fill="#fff" /><circle cx={121} cy={91.5} r={1.8} fill="#fff" />
          <path d="M58 70 L95 83 M142 70 L105 83" stroke={INK} strokeWidth={8} />
          <path d="M80 116 Q100 107 120 116 Q100 127 80 116 Z" fill="#fffaf0" stroke={INK} strokeWidth={4} />
          <path d="M90 112 V121 M100 110 V123 M110 112 V121" stroke={INK} strokeWidth={2.5} />
        </>
      )}
      {mood === "smug" && (
        <>
          <ellipse cx={78} cy={92} rx={15} ry={12} fill="#fff" stroke={INK} strokeWidth={3.5} />
          <ellipse cx={122} cy={92} rx={15} ry={12} fill="#fff" stroke={INK} strokeWidth={3.5} />
          <circle cx={84} cy={95} r={6} fill={INK} /><circle cx={128} cy={95} r={6} fill={INK} />
          <path d="M62 92 A16 13 0 0 1 94 92 Z" fill="#c8702f" stroke={INK} strokeWidth={3.5} />
          <path d="M106 92 A16 13 0 0 1 138 92 Z" fill="#c8702f" stroke={INK} strokeWidth={3.5} />
          <path d="M60 77 L95 80 M106 73 Q124 61 142 70" stroke={INK} strokeWidth={7} />
          <path d="M84 118 Q104 125 121 110" stroke={INK} strokeWidth={5} />
        </>
      )}
      {mood === "defeated" && (
        <>
          <path d="M70 83 L86 99 M86 83 L70 99 M114 83 L130 99 M130 83 L114 99" stroke={INK} strokeWidth={6} />
          <path d="M82 119 Q91 112 100 119 Q109 126 118 119" stroke={INK} strokeWidth={4.5} />
          <path d="M150 52 C150 52 140 64 140 70 A10 10 0 0 0 160 70 C160 64 150 52 150 52 Z" fill="#bfe3f2" stroke={INK} strokeWidth={3} />
        </>
      )}
    </svg>
  );
}
