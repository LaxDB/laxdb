export interface ScoreWormInteractionState {
  readonly activatedSequence: number | null;
  readonly focusedSequence: number | null;
  readonly hoveredSequence: number | null;
}

export type ScoreWormInteraction =
  | { readonly type: "activate"; readonly sequence: number }
  | { readonly type: "blur" }
  | { readonly type: "dismiss" }
  | { readonly type: "focus"; readonly sequence: number }
  | { readonly type: "hover"; readonly sequence: number | null };

export const initialScoreWormInteraction: ScoreWormInteractionState = {
  activatedSequence: null,
  focusedSequence: null,
  hoveredSequence: null,
};

export const activeScoreWormSequence = (
  state: Readonly<ScoreWormInteractionState>,
): number | null =>
  state.focusedSequence ?? state.activatedSequence ?? state.hoveredSequence;

export const reduceScoreWormInteraction = (
  state: Readonly<ScoreWormInteractionState>,
  interaction: Readonly<ScoreWormInteraction>,
): ScoreWormInteractionState => {
  switch (interaction.type) {
    case "activate":
      return state.activatedSequence === interaction.sequence
        ? initialScoreWormInteraction
        : { ...state, activatedSequence: interaction.sequence };
    case "blur":
      return { ...state, focusedSequence: null };
    case "dismiss":
      return initialScoreWormInteraction;
    case "focus":
      return { ...state, focusedSequence: interaction.sequence };
    case "hover":
      return { ...state, hoveredSequence: interaction.sequence };
    default: {
      const exhaustiveInteraction: never = interaction;
      return exhaustiveInteraction;
    }
  }
};
