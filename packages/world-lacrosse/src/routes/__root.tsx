/// <reference types="vite/client" />

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Agentation } from "agentation";

import { HomeFooter } from "../components/home-footer";
import { NotFound } from "../components/not-found";
import stylesUrl from "../styles.css?url";

const siteTitle = "2026 Women's Lacrosse Championship | LaxDB";
const siteDescription =
  "Scores, schedules, standings, statistics, and match analysis for the 2026 World Lacrosse Women's Championship.";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f6f3ea" },
      { title: siteTitle },
      { name: "description", content: siteDescription },
      { property: "og:title", content: siteTitle },
      { property: "og:description", content: siteDescription },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: stylesUrl },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: () => <NotFound />,
});

function RootDocument() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <HomeFooter />
        </QueryClientProvider>
        {import.meta.env.DEV ? (
          <Agentation endpoint="http://localhost:4747" />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
