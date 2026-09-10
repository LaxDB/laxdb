/// <reference types="vite/client" />

import { RegistryProvider } from "@effect/atom-react";
import { ThemeProvider } from "@laxdb/ui/components/theme-provider";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Agentation } from "agentation";

import { AppShell } from "@/components/app-shell";
import globalsCss from "@/globals.css?url";
import { siteConfig } from "@/site";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Page not found</p>
    </div>
  );
}

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: siteConfig.name },
      { name: "description", content: siteConfig.description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: siteConfig.name },
      { property: "og:description", content: siteConfig.description },
    ],
    links: [{ rel: "stylesheet", href: globalsCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
        <RegistryProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <AppShell>
              <Outlet />
            </AppShell>
          </ThemeProvider>
        </RegistryProvider>
        {import.meta.env.DEV ? (
          <Agentation endpoint="http://localhost:4747" />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
