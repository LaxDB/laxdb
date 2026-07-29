import { createRootRoute, Outlet } from "@tanstack/react-router";

import { HomeFooter } from "../components/home-footer";
import { NotFound } from "../components/not-found";

function RootLayout() {
  return (
    <>
      <Outlet />
      <HomeFooter />
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
});
