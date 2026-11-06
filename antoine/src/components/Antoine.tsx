import { bodyColors, defaultLook, scarfColors, type Look } from "@/lib/game/cosmetics";

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
const HONEY = "#f0b429";

export function Antoine({ mood = "wave", size = 160, decorative = false, animated = false, className, look = defaultLook }: { mood?: AntoineMood; size?: number; decorative?: boolean; animated?: boolean; className?: string; look?: Look }) {
  const height = Math.round((size * 250) / 224);
  const body = bodyColors[look.body] ?? bodyColors.red!;
  const scarf = scarfColors[look.scarf] ?? scarfColors.honey!;
  const barong = look.outfit === "barong";
  const arm = arms[mood];
  // When waving and animated, the raised right arm is its own group so it can swing from the shoulder.
  const splitWave = animated && mood === "wave";
  const staticArm = splitWave ? "M82 157 Q66 167 64 182" : arm.path;
  const staticHands = splitWave ? arm.hands.slice(0, 1) : arm.hands;
  const sparkle = mood === "cheer" || mood === "proud";
  return (
    <svg
      className={[className, animated ? "antoine--alive" : ""].filter(Boolean).join(" ") || undefined}
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
        <path d={staticArm} fill="none" strokeWidth={23} />
        {staticHands.map(([x, y]) => <circle key={`u${x}`} cx={x} cy={y} r={13} stroke="none" />)}
      </g>
      {splitWave && (
        <g className="antoine__wave" fill="#fff" stroke="#fff">
          <path d="M118 157 Q142 147 152 121" fill="none" strokeWidth={23} />
          <circle cx={153} cy={117} r={13} stroke="none" />
        </g>
      )}

      {/* body */}
      <path d="M84 36 C78 16 64 8 52 12 M116 36 C122 16 136 8 148 12" stroke={INK} strokeWidth={7} />
      <circle cx={50} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <circle cx={150} cy={12} r={9.5} fill={HONEY} stroke={INK} strokeWidth={4} />
      <path d="M86 198 L80 213 M114 198 L120 213" stroke={INK} strokeWidth={10} />
      <ellipse cx={75} cy={216} rx={11} ry={5.5} fill={INK} />
      <ellipse cx={125} cy={216} rx={11} ry={5.5} fill={INK} />
      <ellipse cx={100} cy={180} rx={38} ry={28} fill={body.fill} stroke={INK} strokeWidth={5} />
      <path d="M68 180 Q100 192 132 180 M76 195 Q100 204 124 195" stroke={body.shade} strokeWidth={5} />
      <ellipse cx={84} cy={166} rx={10} ry={4.5} fill={body.light} transform="rotate(-20 84 166)" />
      <ellipse cx={100} cy={148} rx={20} ry={15} fill={body.fill} stroke={INK} strokeWidth={5} />
      {barong && <Barong />}

      {mood === "calm" && (
        <g transform="rotate(-6 100 178)">
          <rect x={74} y={152} width={52} height={54} rx={6} fill="#fffaf0" stroke={INK} strokeWidth={4} />
          <rect x={91} y={147} width={18} height={9} rx={2.5} fill={HONEY} stroke={INK} strokeWidth={3} />
          <path d="M84 170 H116 M84 180 H116 M84 190 H104" stroke={INK} strokeWidth={3.5} />
        </g>
      )}

      {/* scarf */}
      {!barong && (
        <>
          <path d="M66 134 Q100 152 134 134 L136 145 Q100 164 64 145 Z" fill={scarf.fill} stroke={INK} strokeWidth={4} />
          <path d="M117 151 L130 173 L116 170 Z" fill={scarf.fill} stroke={INK} strokeWidth={4} />
          <circle cx={118} cy={151} r={6.5} fill={scarf.knot} stroke={INK} strokeWidth={3} />
        </>
      )}

      {/* arms */}
      <path d={staticArm} stroke={INK} strokeWidth={9} />
      {staticHands.map(([x, y]) => <circle key={`h${x}`} cx={x} cy={y} r={8} fill={INK} />)}
      {splitWave && (
        <g className="antoine__wave">
          <path d="M118 157 Q142 147 152 121" stroke={INK} strokeWidth={9} />
          <circle cx={153} cy={117} r={8} fill={INK} />
        </g>
      )}

      {/* head */}
      <circle cx={100} cy={84} r={58} fill={body.fill} stroke={INK} strokeWidth={5} />
      <ellipse cx={73} cy={50} rx={18} ry={8} fill={body.light} transform="rotate(-28 73 50)" />
      <ellipse cx={57} cy={113} rx={10} ry={6} fill={body.cheek} />
      <ellipse cx={143} cy={113} rx={10} ry={6} fill={body.cheek} />

      <Face mood={mood} />
      {look.eyes !== "none" && mood !== "cheer" && mood !== "sleep" && <Eyewear kind={look.eyes} />}
      {look.hat !== "none" && <Hat kind={look.hat} />}

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
    <g className="antoine__eyes">
      <ellipse cx={78} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={3.5} />
      <ellipse cx={122} cy={92} rx={16.5} ry={20.5} fill="#fff" stroke={INK} strokeWidth={3.5} />
      <circle cx={lookDown ? 79 : 81} cy={py} r={lookDown ? 10 : 11} fill={INK} />
      <circle cx={lookDown ? 123 : 125} cy={py} r={lookDown ? 10 : 11} fill={INK} />
      <circle cx={lookDown ? 83 : 86} cy={hy} r={lookDown ? 4 : 4.6} fill="#fff" />
      <circle cx={lookDown ? 127 : 130} cy={hy} r={lookDown ? 4 : 4.6} fill="#fff" />
      {!lookDown && <><circle cx={76} cy={103} r={2.1} fill="#fff" /><circle cx={120} cy={103} r={2.1} fill="#fff" /></>}
    </g>
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
      <circle cx={100} cy={84} r={58} fill="#e31e24" stroke={INK} strokeWidth={6} />
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

function Barong() {
  return (
    <g>
      <path d="M62 140 Q100 156 138 140 L144 196 Q100 214 56 196 Z" fill="#fbf3dc" stroke={INK} strokeWidth={4.5} />
      <path d="M86 156 C92 170 92 184 86 198 M114 156 C108 170 108 184 114 198" stroke="#8a5a00" strokeWidth={2.5} />
      <path d="M78 168 C82 172 82 178 78 182 M122 168 C118 172 118 178 122 182" stroke="#8a5a00" strokeWidth={2} />
      <path d="M82 140 L100 158 L118 140" stroke={INK} strokeWidth={4} />
      {[168, 182, 196].map((y) => <circle key={y} cx={100} cy={y} r={2.6} fill={INK} />)}
    </g>
  );
}

function Eyewear({ kind }: { kind: string }) {
  if (kind === "shades") {
    return (
      <g>
        <path d="M56 80 H96 Q99 80 99 84 V97 Q99 110 85 110 H70 Q56 110 56 96 Z" fill={INK} stroke={INK} strokeWidth={3} />
        <path d="M101 84 Q101 80 104 80 H144 V96 Q144 110 130 110 H115 Q101 110 101 97 Z" fill={INK} stroke={INK} strokeWidth={3} />
        <path d="M96 84 Q100 80 104 84" stroke={INK} strokeWidth={4} />
        <path d="M64 88 L76 86 M109 88 L121 86" stroke="#fff" strokeWidth={3} opacity={0.6} />
        <path d="M56 86 L44 80 M144 86 L156 80" stroke={INK} strokeWidth={4} />
      </g>
    );
  }
  return (
    <g fill="none" stroke={INK}>
      <circle cx={78} cy={92} r={23} strokeWidth={4.5} />
      <circle cx={122} cy={92} r={23} strokeWidth={4.5} />
      <path d="M100 88 Q100 84 100 88 M99 90 Q100 86 101 90" strokeWidth={4} />
      <path d="M55 88 L44 82 M145 88 L156 82" strokeWidth={4} />
    </g>
  );
}

function Hat({ kind }: { kind: string }) {
  switch (kind) {
    case "hardhat":
      return (
        <g strokeLinejoin="round">
          <path d="M46 66 C46 12 154 12 154 66 Z M28 64 H172 Q176 76 164 78 H36 Q24 76 28 64 Z" fill="#fff" stroke="#fff" strokeWidth={12} />
          <path d="M46 66 C46 12 154 12 154 66 Z" fill={HONEY} stroke={INK} strokeWidth={5} />
          <path d="M100 16 V62 M72 26 Q66 44 66 62 M128 26 Q134 44 134 62" stroke="#c98e0f" strokeWidth={4} />
          <path d="M28 64 H172 Q176 76 164 78 H36 Q24 76 28 64 Z" fill={HONEY} stroke={INK} strokeWidth={5} />
        </g>
      );
    case "salakot":
      return (
        <g strokeLinejoin="round">
          <path d="M12 70 L100 2 L188 70 Q100 88 12 70 Z" fill="#fff" stroke="#fff" strokeWidth={12} />
          <path d="M12 70 L100 2 L188 70 Q100 88 12 70 Z" fill="#d9b77c" stroke={INK} strokeWidth={5} />
          <path d="M100 4 L56 76 M100 4 L144 76 M100 4 L100 82 M100 4 L32 72 M100 4 L168 72" stroke="#b88b52" strokeWidth={2.6} />
          <path d="M14 70 Q100 88 186 70" stroke="#8a5a00" strokeWidth={4} />
          <circle cx={100} cy={6} r={6.5} fill="#8a5a00" stroke={INK} strokeWidth={3} />
        </g>
      );
    default: {
      const balikbayan = kind === "balikbayan";
      const crown = balikbayan ? INK : "#2f638d";
      const brim = balikbayan ? "#3b2a1e" : "#244f73";
      return (
        <g strokeLinejoin="round">
          <path d="M42 66 C40 16 160 16 158 66 Q100 54 42 66 Z M100 62 Q150 56 186 70 Q178 82 150 78 Q120 74 100 70 Z" fill="#fff" stroke="#fff" strokeWidth={12} />
          <path d="M42 66 C40 16 160 16 158 66 Q100 54 42 66 Z" fill={crown} stroke={INK} strokeWidth={5} />
          <path d="M100 62 Q150 56 186 70 Q178 82 150 78 Q120 74 100 70 Z" fill={brim} stroke={INK} strokeWidth={5} />
          <circle cx={100} cy={22} r={4.5} fill={balikbayan ? HONEY : "#fffaf0"} stroke={INK} strokeWidth={2.5} />
          {balikbayan
            ? <path d="M100 30 L104.7 39.5 L115 41 L107.5 48.3 L109.3 58.6 L100 53.7 L90.7 58.6 L92.5 48.3 L85 41 L95.3 39.5 Z" fill={HONEY} stroke={INK} strokeWidth={2} />
            : <path d="M70 40 Q100 30 130 40" stroke="#fffaf0" strokeWidth={4} opacity={0.5} />}
        </g>
      );
    }
  }
}
