import { Effect, type Layer } from "effect";

export const makeTestRunner =
  <R>(layer: Layer.Layer<R>) =>
  <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, layer));
