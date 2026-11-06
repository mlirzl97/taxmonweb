"use client";

import { useState } from "react";

import { Anay } from "@/components/Anay";
import { Antoine } from "@/components/Antoine";
import { useGame } from "@/components/GameProvider";

const slides = [
  { art: <Antoine mood="wave" size={150} animated />, title: "Hi, I'm Antoine!", body: "My friends call me Tonyo. This is your colony. Every filing you finish digs the anthill deeper." },
  { art: <Antoine mood="calm" size={150} />, title: "Tap Now for your next match", body: "Each task is a match. XP only lands when the work is verified: accepted, evidenced, paid." },
  { art: <Anay mood="smug" size={170} />, title: "Beat Anay by D-1", body: "File one working day early to hit Anay. Clear his health together for All Clear. Don't fall behind!" },
];

/** First-run welcome. Three cards, skippable, never shown again once finished. */
export function Coach() {
  const { onboarded, finishOnboarding, hydrated } = useGame();
  const [step, setStep] = useState(0);
  if (!hydrated || onboarded) return null;
  const slide = slides[step]!;
  const last = step === slides.length - 1;
  return (
    <div className="coach" role="dialog" aria-modal="true" aria-label="Welcome to Antoine">
      <div className="coach__card">
        <div className="coach__art" style={{ background: step === 2 ? "var(--soil)" : "var(--honey)" }}>{slide.art}</div>
        <h2 className="display-l" style={{ fontSize: 26 }}>{slide.title}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{slide.body}</p>
        <div className="coach__dots" aria-hidden>{slides.map((_, i) => <i key={i} data-on={i === step} />)}</div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={finishOnboarding}>Skip</button>
          <button className="btn btn--primary" type="button" onClick={() => (last ? finishOnboarding() : setStep(step + 1))}>{last ? "Let's go!" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
