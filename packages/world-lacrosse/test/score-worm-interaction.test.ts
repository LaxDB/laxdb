import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  activeScoreWormSequence,
  initialScoreWormInteraction,
  reduceScoreWormInteraction,
} from "../src/components/score-worm-interaction";

const interact = (
  state: Parameters<typeof reduceScoreWormInteraction>[0],
  interaction: Parameters<typeof reduceScoreWormInteraction>[1],
) => reduceScoreWormInteraction(state, interaction);

describe("score worm marker interaction", () => {
  it("uses the same activation toggle for click, touch click, and native keyboard click", () => {
    const focused = interact(initialScoreWormInteraction, {
      type: "focus",
      sequence: 22,
    });
    expect(activeScoreWormSequence(focused)).toBe(22);

    const activated = interact(focused, { type: "activate", sequence: 22 });
    expect(activated.activatedSequence).toBe(22);
    expect(activeScoreWormSequence(activated)).toBe(22);

    const toggledOff = interact(activated, {
      type: "activate",
      sequence: 22,
    });
    expect(toggledOff).toEqual(initialScoreWormInteraction);
    expect(activeScoreWormSequence(toggledOff)).toBeNull();
  });

  it("keeps focus and activation ahead of proximity hover", () => {
    const hovered = interact(initialScoreWormInteraction, {
      type: "hover",
      sequence: 10,
    });
    expect(activeScoreWormSequence(hovered)).toBe(10);

    const activated = interact(hovered, {
      type: "activate",
      sequence: 12,
    });
    expect(activeScoreWormSequence(activated)).toBe(12);

    const focused = interact(activated, { type: "focus", sequence: 14 });
    expect(activeScoreWormSequence(focused)).toBe(14);

    const blurred = interact(focused, { type: "blur" });
    expect(activeScoreWormSequence(blurred)).toBe(12);
  });

  it("routes native button activation through click without a pointerdown toggle", async () => {
    const component = await readFile(
      new URL("../src/components/score-worm.tsx", import.meta.url),
      "utf8",
    );

    expect(component).toContain("onClick={onActivate}");
    expect(component).not.toContain("onPointerDown=");
  });

  it("keeps direct fine-pointer markers above the proximity hover layer", async () => {
    const styles = await readFile(
      new URL("../src/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.score-worm-goal-trigger \{[^}]*z-index: 4;[^}]*pointer-events: auto;/su,
    );
    expect(styles).toMatch(/\.score-worm-hover-layer \{[^}]*z-index: 3;/su);
    expect(styles).toMatch(
      /@media \(hover: none\), \(pointer: coarse\) \{\s*\.score-worm-goal-trigger \{\s*width: 32px;\s*height: 32px;/su,
    );
  });

  it("dismisses every interaction source for Escape and outside close", () => {
    const active = {
      activatedSequence: 12,
      focusedSequence: 14,
      hoveredSequence: 10,
    };

    expect(interact(active, { type: "dismiss" })).toEqual(
      initialScoreWormInteraction,
    );
  });
});
