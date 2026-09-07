import { createMiddleware } from "@tanstack/react-start";

export const apiAuth = createMiddleware().server(({ request, next }) =>
  next({ context: { apiCookie: request.headers.get("cookie") ?? undefined } }),
);
