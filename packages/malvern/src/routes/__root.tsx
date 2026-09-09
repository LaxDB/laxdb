import { RegistryContext } from "@effect/atom-react";
import { meAtom } from "@laxdb/frontend/auth";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";

import { NotFound } from "../components/not-found";
import appCss from "../styles.css?url";

const PUBLIC_PATHS = ["/login", "/accept-invitation"];
const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

export const Route = createRootRouteWithContext<{
  registry: AtomRegistry.AtomRegistry;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Malvern Lacrosse" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  beforeLoad: async ({ context, location }) => {
    if (isPublic(location.pathname)) return { me: null };
    const me = await Effect.runPromise(
      AtomRegistry.getResult(context.registry, meAtom, {
        suspendOnWaiting: true,
      }),
    );
    if (!me) throw redirect({ to: "/login" });
    if (!me.activeOrganizationId && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    return { me };
  },
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const { registry } = Route.useRouteContext();
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <RegistryContext.Provider value={registry}>
          <Outlet />
        </RegistryContext.Provider>
        <Scripts />
      </body>
    </html>
  );
}
