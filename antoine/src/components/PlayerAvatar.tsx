"use client";

import Link from "next/link";

import { Antoine, type AntoineMood } from "@/components/Antoine";
import { useGame } from "@/components/GameProvider";

/** Your own ant, wearing what you equipped. Shown wherever "you" appear. */
export function PlayerAvatar({ size = 48, href, rank, mood = "wave", label }: { size?: number; href?: string; rank?: number; mood?: AntoineMood; label?: string }) {
  const { look } = useGame();
  const gold = look.frame === "gold";
  const face = (
    <span className={`player-avatar${gold ? " player-avatar--gold" : ""}`} style={{ width: size, height: size }}>
      <span style={{ marginBottom: -Math.round(size * 0.42) }}><Antoine mood={mood} size={Math.round(size * 1.05)} decorative look={look} /></span>
    </span>
  );
  const badge = rank ? <span className="shield player-avatar__badge" aria-hidden>{rank}</span> : null;
  if (href) return <Link href={href} className="avatar-wrap" aria-label={label}>{face}{badge}</Link>;
  return <span className="avatar-wrap" role={label ? "img" : undefined} aria-label={label}>{face}{badge}</span>;
}
