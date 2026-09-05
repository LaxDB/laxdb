import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { AtomRegistry, Hydration } from "effect/unstable/reactivity";

import { routeTree } from "./route-tree.gen";

export function getRouter() {
  // Each server request and browser router owns a separate cache.
  const registry = AtomRegistry.make();

  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    context: { registry },
    dehydrate: () => ({ atoms: Hydration.dehydrate(registry) }),
    hydrate: (state) => {
      Hydration.hydrate(registry, state.atoms);
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
