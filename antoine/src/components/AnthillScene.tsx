"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Antoine } from "@/components/Antoine";
import { useGame } from "@/components/GameProvider";

const INK = "#1d1d1b";
const TUNNELS = {
  left: "M195 80 L195 148 Q195 168 175 176 L124 194",
  right: "M195 150 Q200 168 228 175 L282 188",
  down: "M195 150 L195 232 Q195 250 182 262",
  surface: "M404 123 C340 123 290 123 262 116 C240 108 222 92 202 79",
};

type WalkerSpec = { path: keyof typeof TUNNELS; dur: number; offset: number; carry?: boolean; still: string };

const WALKERS: WalkerSpec[] = [
  { path: "surface", dur: 11, offset: 0, carry: true, still: "translate(338 122) scale(-1 1)" },
  { path: "surface", dur: 11, offset: 0.45, carry: true, still: "translate(362 122) scale(-1 1)" },
  { path: "left", dur: 7, offset: 0, carry: true, still: "translate(152 184) rotate(160)" },
  { path: "left", dur: 7, offset: 0.5, still: "translate(195 104) rotate(90)" },
  { path: "right", dur: 8, offset: 0.15, carry: true, still: "translate(246 179) rotate(14)" },
  { path: "down", dur: 6, offset: 0.1, carry: true, still: "translate(195 212) rotate(90)" },
  { path: "down", dur: 6, offset: 0.6, still: "translate(195 132) rotate(-90)" },
];

/**
 * Worker ants walking the tunnels there and back. Driven by requestAnimationFrame
 * along the real tunnel paths so it behaves the same in every browser.
 */
function Walkers({ animate }: { animate: boolean }) {
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const antRefs = useRef<Array<SVGUseElement | null>>([]);

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const lengths: Record<string, number> = {};
    for (const [key, el] of Object.entries(pathRefs.current)) if (el) lengths[key] = el.getTotalLength();
    const tick = (now: number) => {
      WALKERS.forEach((w, i) => {
        const el = pathRefs.current[w.path];
        const ant = antRefs.current[i];
        if (!el || !ant) return;
        const t = ((now / 1000 / w.dur) + w.offset) % 1;
        const back = t >= 0.5;
        const u = t < 0.45 ? t / 0.45 : t < 0.5 ? 1 : t < 0.95 ? 1 - (t - 0.5) / 0.45 : 0;
        const len = lengths[w.path] ?? 0;
        const at = el.getPointAtLength(u * len);
        const ahead = el.getPointAtLength(Math.min(len, u * len + 1));
        const behind = el.getPointAtLength(Math.max(0, u * len - 1));
        let angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
        if (back) angle += 180;
        ant.setAttribute("transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  return (
    <g data-walkers={animate ? "moving" : "still"}>
      {Object.entries(TUNNELS).map(([key, d]) => <path key={key} ref={(el) => { pathRefs.current[key] = el; }} d={d} stroke="none" fill="none" />)}
      {WALKERS.map((w, i) => (
        <use key={i} ref={(el) => { antRefs.current[i] = el; }} href={w.carry ? "#antc" : "#ant"} transform={w.still} className="walker" />
      ))}
    </g>
  );
}

/** Every label links to a real record class; the picture only ever reflects tracked facts. */
export function AnthillScene({ needCount, chambers, late }: { needCount: number; chambers: { done: string[]; digging: string; progress: string }; late: number }) {
  const { motion } = useGame();
  return (
    <section className="anthill" aria-label="Your colony this cycle">
      <svg className="scene" viewBox="0 0 390 330" fill="none" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={`Anthill: ${chambers.done.join(" and ")} chambers cleared, ${chambers.digging} being dug, Anay tunnelling in from the right`}>
        <defs>
          <g id="ant">
            <path d="M3 1 L1 5 M5.2 1.2 L5 5.6 M7 1 L9.5 4.6 M3 -1 L1 -5 M5.2 -1.2 L5 -5.6 M7 -1 L9.5 -4.6" stroke={INK} strokeWidth={1.1} className="ant-legs" />
            <path d="M10.6 -1.4 L13.6 -4.4 M10.6 1.4 L13.6 4.4" stroke={INK} strokeWidth={1} />
            <ellipse cx={0} cy={0} rx={3.2} ry={2.6} fill="#e31e24" stroke={INK} strokeWidth={0.8} />
            <circle cx={5.2} cy={0} r={1.9} fill="#e31e24" stroke={INK} strokeWidth={0.8} />
            <circle cx={9.4} cy={0} r={2.5} fill="#e31e24" stroke={INK} strokeWidth={0.8} />
          </g>
          <g id="antc">
            <use href="#ant" />
            <rect x={6} y={-9.5} width={7} height={5.5} rx={1} fill="#fffaf0" stroke={INK} strokeWidth={1.1} />
          </g>
        </defs>

        <g className="sun">
          <circle cx={342} cy={40} r={32} fill="#f7d27a" opacity={0.35} className="sun__halo" />
          <circle cx={342} cy={40} r={24} fill="#f7d27a" />
        </g>
        <path d="M0 112 C60 98 110 106 160 100 C220 92 280 104 390 96 L390 128 L0 128 Z" fill="#ece0c4" />
        <rect x={0} y={128} width={390} height={202} fill="#dcbd84" />
        <path d="M0 214 C80 206 140 224 220 216 C300 208 340 220 390 214 L390 330 L0 330 Z" fill="#cfa86c" />
        <path d="M0 292 C90 286 170 300 260 292 C320 287 360 294 390 290 L390 330 L0 330 Z" fill="#b98a52" />
        <g fill="#b88b52">
          <ellipse cx={34} cy={160} rx={4} ry={2.6} /><ellipse cx={262} cy={150} rx={3} ry={2} /><ellipse cx={358} cy={172} rx={5} ry={3} />
          <ellipse cx={58} cy={252} rx={4} ry={2.4} /><ellipse cx={248} cy={246} rx={3.4} ry={2.2} /><ellipse cx={370} cy={238} rx={3} ry={2} /><ellipse cx={22} cy={300} rx={4.4} ry={2.6} />
        </g>
        <path d="M86 129 C128 127 154 74 195 70 C236 74 262 127 304 129 Z" fill="#c99a5b" stroke={INK} strokeWidth={2.5} />
        <path d="M150 112 C160 100 168 92 176 86" stroke="#e2bd85" strokeWidth={3} />
        <ellipse cx={195} cy={74} rx={11} ry={5} fill={INK} />
        <path d="M0 128 L390 128" stroke={INK} strokeWidth={2.5} />
        <g stroke="#1f6b45" strokeWidth={2}>
          {[[18, 0], [64, 0.6], [318, 1.1], [368, 0.3]].map(([x, delay]) => (
            <g key={x} className="grass" style={{ transformOrigin: `${x! + 5}px 128px`, animationDelay: `${delay}s` }}>
              <path d={`M${x} 128 l3 -9 M${x! + 5} 128 l0 -11 M${x! + 10} 128 l-3 -8`} />
            </g>
          ))}
        </g>

        <g stroke={INK} strokeWidth={17}><path d={`${TUNNELS.left} ${TUNNELS.right} ${TUNNELS.down}`} /></g>
        <g stroke="#f6efe0" strokeWidth={12.5}><path d={`${TUNNELS.left} ${TUNNELS.right} ${TUNNELS.down}`} /></g>
        <ellipse cx={92} cy={203} rx={37} ry={21} fill="#f6efe0" stroke={INK} strokeWidth={2.5} />
        <ellipse cx={313} cy={197} rx={35} ry={20} fill="#f6efe0" stroke={INK} strokeWidth={2.5} />
        <ellipse cx={160} cy={277} rx={46} ry={23} fill="#f6efe0" stroke={INK} strokeWidth={2.5} />
        <ellipse cx={160} cy={277} rx={40} ry={18} stroke="#e31e24" strokeWidth={1.8} strokeDasharray="4 5" className="dig" />
        <g fill="#f0b429" stroke={INK} strokeWidth={1.3}>
          {[[70, 214], [81, 214], [92, 214], [103, 214], [114, 214], [75.5, 205], [86.5, 205], [97.5, 205], [108.5, 205], [81, 196], [92, 196], [103, 196],
            [292, 207], [303, 207], [314, 207], [325, 207], [336, 207], [297.5, 198], [308.5, 198], [319.5, 198], [330.5, 198], [314, 189],
            [133, 289], [144, 289], [155, 289], [138.5, 280]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={5} />)}
        </g>

        {/* the colony at work */}
        <Walkers animate={motion.animate} />
        <use href="#antc" transform="translate(172 279) rotate(190)" className="digger" />
        <use href="#ant" transform="translate(178 268) rotate(-30)" className="digger digger--b" />

        {/* Anay tunnelling in */}
        <path d="M392 304 L374 298 L362 307 L349 300 L336 309 L322 303" stroke={INK} strokeWidth={13} />
        <path d="M392 304 L374 298 L362 307 L349 300 L336 309 L322 303" stroke="#3b2a1e" strokeWidth={9} />
        <g transform="translate(316 303)">
          <g className="termite">
            <path d="M-9 -4 L-15 -8 M-9 4 L-15 8" stroke="#5a2e14" strokeWidth={2.4} className="termite__jaws" />
            <ellipse cx={0} cy={0} rx={8} ry={6} fill="#c8702f" stroke={INK} strokeWidth={1.8} />
            <circle cx={-3} cy={0.4} r={1.4} fill="#fff" />
          </g>
        </g>
        <path d="M0 330 L0 322 Q12 314 24 322 T48 322 T72 322 T96 322 T120 322 T144 322 T168 322 T192 322 T216 322 T240 322 T264 322 T288 322 T312 322 T336 322 T360 322 T384 322 T408 322 L390 330 Z" fill="#f6efe0" />
      </svg>

      <div className="tonyo"><Antoine mood="wave" size={62} decorative animated={motion.animate} /></div>
      <p className="speech" role="note">{needCount === 0 ? "Wala nang kailangan." : `${needCount} need you today.`}<strong>{needCount === 0 ? "Pahinga muna!" : "Kaya natin 'to!"}</strong></p>

      <span className="tag" style={{ left: "15%", top: "50%" }}><Check />{chambers.done[0]} · CLEAR</span>
      <span className="tag" style={{ left: "72%", top: "49%" }}><Check />{chambers.done[1]} · CLEAR</span>
      <Link className="tag tag--now" href="/work" style={{ left: "28%", top: "72.5%" }}>{chambers.digging} · DIGGING {chambers.progress}</Link>
      <Link className="tag tag--anay" href="/anay" style={{ left: "70%", top: "82%" }}>ANAY · {late} LATE</Link>
    </section>
  );
}

function Check() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#f0b429" strokeWidth={4} strokeLinecap="round" aria-hidden><path d="M4 12l5 5L20 6" /></svg>;
}
