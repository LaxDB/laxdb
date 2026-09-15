import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent,
} from "react";

import type { CardPlayer, CardSide, CardTeam } from "../../lib/player-cards";

import { PlayerCard } from "./player-card";

interface InteractivePlayerCardProps {
  player: CardPlayer;
  team: CardTeam;
  side: CardSide;
  flipDirection: -1 | 1;
  onSideChange: (side: CardSide) => void;
}

interface CardDrag {
  pointerId: number;
  x: number;
  y: number;
  angle: number;
  moved: boolean;
}

const cardSpring = { stiffness: 450, damping: 38, mass: 0.6 };

function subscribeReducedMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => {
    query.removeEventListener("change", notify);
  };
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerReducedMotion() {
  return true;
}

function nearestFace(angle: number, side: CardSide) {
  const face = side === "back" ? 180 : 0;
  return Math.round((angle - face) / 360) * 360 + face;
}

export function InteractivePlayerCard({
  player,
  team,
  side,
  flipDirection,
  onSideChange,
}: InteractivePlayerCardProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(side === "back" ? 180 : 0);
  const rotateX = useSpring(targetX, cardSpring);
  const rotateY = useSpring(targetY, cardSpring);
  const lightX = useTransform(
    rotateY,
    (angle) => `${Math.sin((angle * Math.PI) / 180) * 140 - 12}%`,
  );
  const lightY = useTransform(rotateX, (angle) => `${angle * 2}%`);
  const drag = useRef<CardDrag | null>(null);
  const suppressClick = useRef(false);
  const previousSide = useRef(side);

  useEffect(() => {
    drag.current = null;
    targetX.set(0);
    const angle = targetY.get();
    let next = nearestFace(angle, side);
    if (previousSide.current !== side) {
      if (flipDirection === 1 && next < angle) next += 360;
      if (flipDirection === -1 && next > angle) next -= 360;
    }
    previousSide.current = side;
    targetY.set(next);
  }, [flipDirection, reducedMotion, side, targetX, targetY]);

  const settle = () => {
    const angle = Math.round(targetY.get() / 180) * 180;
    targetX.set(0);
    targetY.set(angle);
    const back = Math.abs(Math.round(angle / 180) % 2) === 1;
    onSideChange(back ? "back" : "front");
  };

  const cancelDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    suppressClick.current = true;
    targetX.set(0);
    targetY.set(nearestFace(targetY.get(), side));
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion) return;
    const active = drag.current;
    if (active) {
      if (event.pointerId !== active.pointerId) return;
      const dx = event.clientX - active.x;
      const dy = event.clientY - active.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) active.moved = true;
      targetY.set(active.angle + dx * 0.6);
      targetX.set(Math.max(-18, Math.min(18, -dy * 0.18)));
    } else if (event.pointerType === "mouse") {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      targetX.set((0.5 - (event.clientY - bounds.top) / bounds.height) * 10);
      targetY.set(
        nearestFace(targetY.get(), side) +
          ((event.clientX - bounds.left) / bounds.width - 0.5) * 14,
      );
    }
  };

  return (
    <div className="interactive-card">
      <div
        className="interactive-card-stage"
        style={{ viewTransitionName: `player-card-${player.id}` }}
      >
        {reducedMotion ? (
          <PlayerCard player={player} team={team} side={side} />
        ) : (
          <motion.div
            className="interactive-card-rotator"
            style={{ rotateX, rotateY }}
          >
            <div
              className="interactive-card-face interactive-card-front"
              aria-hidden={side !== "front"}
            >
              <PlayerCard player={player} team={team} side="front" />
              <motion.div
                aria-hidden="true"
                className="interactive-card-light"
                style={{ x: lightX, y: lightY }}
              />
            </div>
            <div
              className="interactive-card-face interactive-card-back"
              aria-hidden={side !== "back"}
            >
              <PlayerCard player={player} team={team} side="back" />
              <motion.div
                aria-hidden="true"
                className="interactive-card-light"
                style={{ x: lightX, y: lightY }}
              />
            </div>
          </motion.div>
        )}
        <button
          type="button"
          className="interactive-card-surface"
          aria-label={`Show ${side === "front" ? "back" : "front"} of ${player.firstName} ${player.lastName}'s card`}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (reducedMotion || event.button !== 0 || !event.isPrimary) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              angle: rotateY.get(),
              moved: false,
            };
          }}
          onPointerMove={move}
          onPointerUp={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            drag.current = null;
            suppressClick.current = active.moved;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            if (active.moved) settle();
          }}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onPointerLeave={() => {
            if (drag.current) return;
            targetX.set(0);
            targetY.set(nearestFace(targetY.get(), side));
          }}
          onClick={(event) => {
            if (suppressClick.current && event.detail > 0) {
              suppressClick.current = false;
              return;
            }
            onSideChange(side === "front" ? "back" : "front");
          }}
        />
      </div>
    </div>
  );
}
