"use client";

import Link from "next/link";
import { useState } from "react";

import { Antoine } from "@/components/Antoine";
import { useGame, type MotionPref } from "@/components/GameProvider";
import { isUnlocked, parts, slotLabels, type Look, type Slot } from "@/lib/game/cosmetics";
import { storeItems } from "@/lib/sample-data";

const slots: Slot[] = ["body", "hat", "eyes", "outfit", "scarf", "frame"];

function Lock() {
  return <svg className="wardrobe__lock" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} aria-hidden><rect x={5} y={11} width={14} height={10} rx={2} /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
}

/** Dress your ant. Free parts always; store parts once unlocked. Saving runs through the engine's checks. */
export function Wardrobe() {
  const { hydrated } = useGame();
  // Start the draft from the saved look only once the saved game has loaded.
  return <WardrobeEditor key={hydrated ? "saved" : "loading"} />;
}

function WardrobeEditor() {
  const { look, owned, dispatch, motion, sound } = useGame();
  const [draft, setDraft] = useState<Look>(look);
  const [glow, setGlow] = useState(0);
  const [slot, setSlot] = useState<Slot>("hat");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const changed = (Object.keys(draft) as Slot[]).some((key) => draft[key] !== look[key]);
  const options = parts.filter((p) => p.slot === slot);

  return (
    <section id="wardrobe" className="wardrobe" aria-label="Your ant">
      <div className="section-head"><h2 className="display-m">Your ant</h2><span className="small muted" style={{ fontWeight: 700 }}>Wardrobe</span></div>
      <div className={glow ? "wardrobe__stage wardrobe__stage--glow" : "wardrobe__stage"} key={`stage-${glow}`} data-glow={glow > 0 ? "on" : undefined}>
        <span className="ground" aria-hidden />
        {glow > 0 && motion.animate && <span className="wardrobe__sparkles" aria-hidden>{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ["--i" as string]: i } as React.CSSProperties} />)}</span>}
        <Antoine key={JSON.stringify(draft)} mood={glow ? "cheer" : "wave"} size={150} look={draft} animated={motion.animate} />
      </div>
      <div className="pill-row" role="group" aria-label="Wardrobe slot">
        {slots.map((key) => <button key={key} className="pill" type="button" aria-pressed={slot === key} onClick={() => setSlot(key)}>{slotLabels[key]}</button>)}
      </div>
      <div className="wardrobe__options">
        {options.map((part) => {
          const unlocked = isUnlocked(part, owned);
          const on = draft[slot] === part.id;
          const price = part.storeItem ? storeItems.find((item) => item.id === part.storeItem)?.price : undefined;
          return (
            <button
              key={part.id}
              type="button"
              className="wardrobe__option"
              aria-pressed={on}
              data-locked={!unlocked}
              aria-label={unlocked ? part.label : `${part.label}, locked, ${price} Ants in the store`}
              onClick={() => {
                if (!unlocked) { setMessage({ tone: "error", text: `${part.label} is in the store for ${price?.toLocaleString("en-US")} Ants.` }); return; }
                setDraft({ ...draft, [slot]: part.id }); setMessage(null);
              }}
            >
              {!unlocked && <Lock />}
              {part.swatch ? <span className="wardrobe__swatch" style={{ background: part.swatch }} /> : <span style={{ height: 0 }} />}
              <span>{part.label}</span>
              {!unlocked && <span className="small" style={{ fontWeight: 800 }}>{price?.toLocaleString("en-US")} Ants</span>}
            </button>
          );
        })}
      </div>
      {message && (
        <div className={message.tone === "ok" ? "notice" : "form-error"} role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>{message.text}</span>
          {message.tone === "error" && <Link href="/store" className="chip chip--honey" style={{ textDecoration: "none", flex: "none" }}>Store →</Link>}
        </div>
      )}
      <div className="btn-row">
        <button className="btn" type="button" disabled={!changed} onClick={() => { setDraft(look); setMessage(null); }}>Undo</button>
        <button className="btn btn--primary" type="button" disabled={!changed} onClick={() => {
          const result = dispatch({ type: "equip", actor: "BS", look: draft });
          setMessage(result.ok ? { tone: "ok", text: "Looking good! Your ant is updated everywhere." } : { tone: "error", text: result.error });
          if (result.ok) { setGlow((n) => n + 1); sound.play("sparkle"); }
        }}>Wear this look</button>
      </div>
    </section>
  );
}

/** Everything you own: cosmetics, consumables and pending real rewards. */
export function Inventory() {
  const { state } = useGame();
  const counts = new Map<string, number>();
  for (const purchase of state.purchases) counts.set(purchase.itemId, (counts.get(purchase.itemId) ?? 0) + 1);
  const rows = Array.from(counts.entries()).map(([id, count]) => ({ item: storeItems.find((i) => i.id === id), count, held: state.purchases.some((p) => p.itemId === id && p.status === "held") }));
  return (
    <section aria-label="Inventory" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="section-head"><h2 className="display-m">Inventory</h2><Link href="/store">Store →</Link></div>
      <div className="card">
        <div className="inventory-item"><b style={{ flex: 1 }}>Streak freeze</b><span className="chip chip--quiet">×{1 + (counts.get("freeze") ?? 0)}</span></div>
        <div className="inventory-item"><b style={{ flex: 1 }}>Title · Blocker Buster</b><span className="small muted">Earned</span></div>
        {rows.filter((r) => r.item && r.item.id !== "freeze").map(({ item, held }) => (
          <div key={item!.id} className="inventory-item">
            <b style={{ flex: 1 }}>{item!.label}</b>
            <span className="small" style={{ fontWeight: 700, color: held ? "var(--honey-text)" : "var(--leaf)" }}>{held ? "Waiting for handover" : item!.kind === "digital" ? "Owned" : "Received"}</span>
          </div>
        ))}
        <div className="inventory-item"><b style={{ flex: 1 }}>Culture &amp; Values mug</b><span className="small" style={{ fontWeight: 700, color: "var(--honey-text)" }}>Waiting for handover</span></div>
      </div>
    </section>
  );
}

const motionOptions: Array<[MotionPref, string]> = [["system", "Follow phone"], ["on", "On"], ["off", "Off"]];

export function SoundSetting() {
  const { sound } = useGame();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: "1px solid var(--rule)" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b style={{ fontSize: 15 }}>Sound</b><span className="small muted">Taps, wins, Anay hits and fanfares</span></span>
      <button type="button" role="switch" aria-checked={sound.on} aria-label="Sound" onClick={() => sound.set(!sound.on)} style={{ flex: "none", width: 58, height: 34, borderRadius: 999, border: "2px solid var(--ink)", background: sound.on ? "var(--ant-red)" : "var(--rule)", padding: 0, cursor: "pointer", position: "relative" }}>
        <span style={{ position: "absolute", top: 3, left: sound.on ? 28 : 3, width: 24, height: 24, borderRadius: 999, background: "var(--card)", border: "2px solid var(--ink)", transition: "left 140ms ease" }} />
      </button>
    </div>
  );
}

export function MotionSetting() {
  const { motion } = useGame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--rule)" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <b style={{ fontSize: 15 }}>Animations</b>
        <span className="small muted">{motion.phoneReduced ? "Your phone asks for reduced motion." : "Your phone allows motion."} Now {motion.animate ? "playing" : "paused"}.</span>
      </span>
      <div className="seg" role="group" aria-label="Animations" style={{ background: "var(--ink)" }}>
        {motionOptions.map(([value, label]) => <button key={value} type="button" aria-pressed={motion.pref === value} onClick={() => motion.setPref(value)}>{label}</button>)}
      </div>
    </div>
  );
}
