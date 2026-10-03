import { useEffect, useRef, useState } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { SharedEffect } from "schema";
import type { Banner } from "./TurnBanner";

const BANNER_MS = 1800;
/** Matches the card flip, so the drama lands when the card face does. */
const FLIP_LANDING_MS = 320;

/**
 * Turns the server's shared cues into screen-wide moments (banners, assassin flash and shake),
 * timed with the same server clock as the sounds so everyone sees them together.
 */
export default function useVisualCues(
  effects: SharedEffect[],
  serverClockOffset: number,
) {
  const [banner, setBanner] = useState<Banner>();
  const [flashId, setFlashId] = useState<string>();
  const [shakeScope, animate] = useAnimate<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const later = (ms: number, run: () => void) => {
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          run();
        },
        Math.max(0, ms),
      );
      timers.current.add(timer);
    };
    const showBanner = (next: Banner, at: number) => {
      later(at, () => setBanner(next));
      later(at + BANNER_MS, () =>
        setBanner((current) => (current?.id === next.id ? undefined : current)),
      );
    };

    for (const effect of effects) {
      const delay = effect.playAt - (Date.now() + serverClockOffset);
      // Like sounds: a reconnecting client doesn't replay old moments.
      if (delay < -1000) continue;
      switch (effect.type) {
        case "gameStart":
          showBanner(
            { id: effect.id, kind: "start", team: effect.team },
            delay + 900,
          );
          break;
        case "turnChange":
          showBanner(
            { id: effect.id, kind: "turn", team: effect.team },
            delay + 200,
          );
          break;
        case "perfectClue":
          showBanner(
            { id: effect.id, kind: "perfect", team: effect.team },
            delay,
          );
          break;
        case "assassinReveal":
          later(delay + FLIP_LANDING_MS, () => {
            setFlashId(effect.id);
            if (!reduceMotion && shakeScope.current) {
              void animate(
                shakeScope.current,
                { x: [0, -14, 12, -10, 8, -5, 3, 0], y: [0, 6, -5, 4, -2, 0] },
                { duration: 0.6 },
              );
            }
          });
          later(delay + FLIP_LANDING_MS + 1200, () =>
            setFlashId((current) =>
              current === effect.id ? undefined : current,
            ),
          );
          break;
      }
    }
    // Only new authoritative events schedule moments; clock changes do not replay them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effects]);

  return { banner, flashId, shakeScope };
}
