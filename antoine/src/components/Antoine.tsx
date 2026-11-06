/**
 * Antoine, aka Tonyo — the colony's red ant (style B, bold sticker; 09 §8.3).
 * Built only from circles, ellipses and round-capped lines so moods are part
 * swaps, never redraws.
 */
export type AntoineMood = "wave" | "cheer" | "proud" | "calm" | "sleep";

const labels: Record<AntoineMood, string> = {
  wave: "Antoine the red ant, waving",
  cheer: "Antoine the red ant, cheering",
  proud: "Antoine the red ant, proud, hands on hips",
  calm: "Antoine the red ant, calm with a clipboard",
  sleep: "Antoine the red ant, asleep",
};

const arms: Record<AntoineMood, { path: string; hands: Array<[number, number]> }> = {
  wave: { path: "M82 157 Q66 167 64 182 M118 157 Q142 147 152 121", hands: [[64, 185], [153, 117]] },
  cheer: { path: "M82 157 Q60 147 50 121 M118 157 Q140 147 150 121", hands: [[49, 117], [151, 117]] },
  proud: { path: "M82 157 Q56 160 64 182 M118 157 Q144 160 136 182", hands: [[66, 184], [134, 184]] },
  calm: { path: "M82 157 Q66 169 76 185 M118 157 Q134 169 124 185", hands: [[78, 187], [122, 187]] },
  sleep: { path: "M82 157 Q70 172 72 188 M118 157 Q130 172 128 188", hands: [[72, 191], [128, 191]] },
};

const INK = "#1d1d1b";
const RED = "#e31e24";
const HONEY = "#f0b429";

export function Antoine({ mood = "wave", size = 160, decorative = false, className }: { mood?: AntoineMood; size?: number; decorative?: boolean; className?: string }) {
  const height = Math.round((size * 250) / 224);
  const arm = arms[mood];
  const sparkle = mood === "cheer" || mood === "proud";
  return (
    <svg
      className={className}
      width={size}
      height={height}
      viewBox="-12 -14 224 250"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : labels[mood]}
      aria-hidden={decorative ? true : undefined}
    >
      {/* sticker edge */}
      <g fill="#fff" stroke="#fff">
        <path d="M84 36 C78 16 64 8 52 12 M116 36 C122 16 136 8 148 12" fill="none" strokeWidth={20} />
        <circle cx={50} cy={12} r={17} />
        <circle cx={150} cy={12} r={17} />
        <path d="M86 198 L80 213 M114 198 L120 213" fill="none" strokeWidth={24} />
        <ellipse cx={75} cy={216} rx={18} ry={12} />
        <ellipse cx={125} cy={216} rx={18} ry={12} />
        <ellipse cx={100} cy={180} rx={47} ry={37} stroke="none" />
        <circle cx={100} cy={84} r={67} stroke="none" />
        <path d="M58 134 Q100 158 142 134 L144 150 Q100 172 56 150 Z" strokeWidth={10} />
        <path d={arm.path} fill="none" strokeWidth={23} />
        {arm.hands.map(([x, y]) => <circle key={`u${x}`} cx={x} cy={y} r={13} stroke="none" />)}
      </g>

      {/* body */}
      <path d="M84 36 C78 16 64 8 52 12 M116 36 C122 16 136 8 148 12" stroke={INK} strokeWidth={7} />
      <circle cx={50} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <circle cx={150} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <path d="M86 198 L80 213 M114 198 L120 213" stroke={INK} strokeWidth={10} />
      <ellipse cx={75} cy={216} rx={11} ry={5.5} fill={INK} />
      <ellipse cx={125} cy={216} rx={11} ry={5.5} fill={INK} />
      <ellipse cx={100} cy={180} rx={38} ry={28} fill={RED} stroke={INK} strokeWidth={5} />
      <path d="M68 180 Q100 192 132 180 M76 195 Q100 204 124 195" stroke="#b8191e" strokeWidth={5} />
      <ellipse cx={84} cy={166} rx={10} ry={4.5} fill="#ff7478" transform="rotate(-20 84 166)" />
      <ellipse cx={100} cy={148} rx={20} ry={15} fill={RED} stroke={INK} strokeWidth={5} />

      {mood === "calm" && (
        <g transform="rotate(-6 100 178)">
          <rect x={74} y={152} width={52} height={54} rx={6} fill="#fffaf0" stroke={INK} strokeWidth={4} />
          <rect x={91} y={147} width={18} height={9} rx={2.5} fill={HONEY} stroke={INK} strokeWidth={3} />
          <path d="M84 170 H116 M84 180 H116 M84 190 H104" stroke={INK} strokeWidth={3.5} />
        </g>
      )}

      {/* scarf */}
      <path d="M66 134 Q100 152 134 134 L136 145 Q100 164 64 145 Z" fill={HONEY} stroke={INK} strokeWidth={4} />
      <path d="M117 151 L130 173 L116 170 Z" fill={HONEY} stroke={INK} strokeWidth={4} />
      <circle cx={118} cy={151} r={6.5} fill="#d99a12" stroke={INK} strokeWidth={3} />

      {/* arms */}
      <path d={arm.path} stroke={INK} strokeWidth={9} />
      {arm.hands.map(([x, y]) => <circle key={`h${x}`} cx={x} cy={y} r={8} fill={INK} />)}

      {/* head */}
      <circle cx={100} cy={84} r={58} fill={RED} stroke={INK} strokeWidth={5} />
      <ellipse cx={73} cy={50} rx={18} ry={8} fill="#ff7478" transform="rotate(-28 73 50)" />
      <ellipse cx={57} cy={113} rx={10} ry={6} fill="#ffb0b2" />
      <ellipse cx={143} cy={113} rx={10} ry={6} fill="#ffb0b2" />

      <Face mood={mood} />

      {sparkle && (
        <g fill={HONEY} stroke={INK}>
          <path d="M176 70 L180 82 L192 86 L180 90 L176 102 L172 90 L160 86 L172 82 Z" strokeWidth={3} />
          <path d="M20 112 L22.6 119.4 L30 122 L22.6 124.6 L20 132 L17.4 124.6 L10 122 L17.4 119.4 Z" strokeWidth={2.6} />
        </g>
      )}
    </svg>
  );
}

function OpenEyes({ lookDown = false }: { lookDown?: boolean }) {
  const py = lookDown ? 102 : 97;
  const hy = lookDown ? 96 : 90;
  return (
    <>
      <ellipse cx={78} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={3.5} />
      <ellipse cx={122} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={3.5} />
      <circle cx={lookDown ? 79 : 81} cy={py} r={lookDown ? 10 : 11} fill={INK} />
      <circle cx={lookDown ? 123 : 125} cy={py} r={lookDown ? 10 : 11} fill={INK} />
      <circle cx={lookDown ? 83 : 86} cy={hy} r={lookDown ? 4 : 4.6} fill="#fff" />
      <circle cx={lookDown ? 127 : 130} cy={hy} r={lookDown ? 4 : 4.6} fill="#fff" />
      {!lookDown && <><circle cx={76} cy={103} r={2.1} fill="#fff" /><circle cx={120} cy={103} r={2.1} fill="#fff" /></>}
    </>
  );
}

function Face({ mood }: { mood: AntoineMood }) {
  switch (mood) {
    case "cheer":
      return (
        <>
          <path d="M63 97 Q78 79 93 97 M107 97 Q122 79 137 97" stroke={INK} strokeWidth={6.5} />
          <path d="M62 60 Q76 51 90 57 M110 57 Q124 51 138 60" stroke={INK} strokeWidth={5.5} />
          <path d="M85 110 Q100 137 115 110 Z" fill="#7a0f12" stroke={INK} strokeWidth={4} />
          <ellipse cx={100} cy={125} rx={7} ry={4} fill="#ff9a9d" />
        </>
      );
    case "proud":
      return (
        <>
          <path d="M64 96 Q78 84 92 96 M108 96 Q122 84 136 96" stroke={INK} strokeWidth={6} />
          <path d="M62 66 Q76 58 90 62 M110 58 Q124 50 138 56" stroke={INK} strokeWidth={5.5} />
          <path d="M86 113 Q102 128 116 110" stroke={INK} strokeWidth={5} />
        </>
      );
    case "calm":
      return (
        <>
          <OpenEyes lookDown />
          <path d="M63 65 L90 63 M110 63 L137 65" stroke={INK} strokeWidth={5.5} />
          <path d="M93 119 Q100 122 107 119" stroke={INK} strokeWidth={4.5} />
        </>
      );
    case "sleep":
      return (
        <>
          <path d="M64 94 Q78 104 92 94 M108 94 Q122 104 136 94" stroke={INK} strokeWidth={5.5} />
          <path d="M64 70 Q76 66 88 69 M112 69 Q124 66 136 70" stroke={INK} strokeWidth={5} />
          <ellipse cx={100} cy={119} rx={5} ry={6} fill="#7a0f12" stroke={INK} strokeWidth={3.5} />
          <path d="M160 40 H176 L160 56 H176" stroke="#fff" strokeWidth={12} />
          <path d="M160 40 H176 L160 56 H176" stroke={INK} strokeWidth={5} />
          <path d="M182 14 H192 L182 24 H192" stroke="#fff" strokeWidth={10} />
          <path d="M182 14 H192 L182 24 H192" stroke={INK} strokeWidth={4} />
        </>
      );
    default:
      return (
        <>
          <OpenEyes />
          <path d="M62 63 Q76 56 90 61 M110 61 Q124 56 138 63" stroke={INK} strokeWidth={5.5} />
          <path d="M88 116 Q100 129 112 116" stroke={INK} strokeWidth={5} />
        </>
      );
  }
}

/** Antoine's head only, for the red Now button. */
export function AntoineHead({ size = 31 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 162) / 148)} viewBox="26 -10 148 162" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M84 36 C78 16 64 8 52 12 M116 36 C122 16 136 8 148 12" stroke="#fff" strokeWidth={20} />
      <circle cx={50} cy={12} r={16} fill="#fff" />
      <circle cx={150} cy={12} r={16} fill="#fff" />
      <circle cx={100} cy={84} r={67} fill="#fff" />
      <path d="M84 36 C78 16 64 8 52 12 M116 36 C122 16 136 8 148 12" stroke={INK} strokeWidth={7} />
      <circle cx={50} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <circle cx={150} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <circle cx={100} cy={84} r={58} fill={RED} stroke={INK} strokeWidth={6} />
      <ellipse cx={78} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={4} />
      <ellipse cx={122} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={4} />
      <circle cx={81} cy={97} r={11} fill={INK} />
      <circle cx={125} cy={97} r={11} fill={INK} />
      <circle cx={86} cy={90} r={4.6} fill="#fff" />
      <circle cx={130} cy={90} r={4.6} fill="#fff" />
      <path d="M88 117 Q100 130 112 117" stroke={INK} strokeWidth={6} />
    </svg>
  );
}
