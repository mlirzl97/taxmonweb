"use client";

import { useEffect, useRef, useState } from "react";

import { useGame } from "@/components/GameProvider";

/** Numbers roll to their new value, like a score counter. Instant when motion is off. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US") }: { value: number; format?: (n: number) => string }) {
  const { motion } = useGame();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (!motion.animate || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 650);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(start + (value - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, motion.animate]);

  return <span className="count">{format(shown)}</span>;
}
