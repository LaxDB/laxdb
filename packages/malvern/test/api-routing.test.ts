/// <reference types="bun" />
import { createServer } from "vite";
import { expect, test } from "vitest";

import config from "../vite.config";

test("Vite routes only auth and images, preserving requests and responses", async () => {
  const proxy = config.server?.proxy;
  if (proxy === undefined) throw new Error("Missing API routes");
  expect(Object.keys(proxy)).toEqual(["/api/auth/", "/api/report-images/"]);

  const requests: Request[] = [];
  const cookies = [
    "session=token; Path=/; HttpOnly",
    "state=; Path=/; Max-Age=0",
  ];
  const api = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push(request.clone());
      const headers = new Headers({ location: "/onboarding" });
      for (const cookie of cookies) headers.append("set-cookie", cookie);
      return new Response(await request.text(), {
        status: Number(
          new URL(request.url).searchParams.get("status") ?? "200",
        ),
        headers,
      });
    },
  });

  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    server = await createServer({
      configFile: false,
      root: import.meta.dir,
      appType: "custom",
      logLevel: "silent",
      server: {
        host: "127.0.0.1",
        port: 0,
        proxy: Object.fromEntries(
          Object.entries(proxy).map(([path, options]) => [
            path,
            {
              ...(typeof options === "string" ? {} : options),
              target: api.url.href,
            },
          ]),
        ),
      },
    });
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    if (origin === undefined) throw new Error("Missing Vite URL");
    const headers = {
      origin: new URL(origin).origin,
      cookie: "session=token",
      "content-type": "application/json",
    };

    for (const [path, method, body, status] of [
      [
        "/api/auth/sign-in/magic-link?keep=1",
        "POST",
        '{"email":"user@example.com"}',
        200,
      ],
      ["/api/auth/callback/google?status=302", "GET", undefined, 302],
      ["/api/auth/get-session?status=401", "GET", undefined, 401],
      ["/api/report-images/image-1?keep=1", "GET", undefined, 200],
    ] satisfies [string, string, string | undefined, number][]) {
      const response = await fetch(new URL(path, origin), {
        method,
        ...(body === undefined ? {} : { body }),
        headers,
        redirect: "manual",
      });
      expect(response.status).toBe(status);
      expect(response.headers.getSetCookie()).toEqual(cookies);
      expect(response.headers.get("location")).toBe("/onboarding");
      expect(await response.text()).toBe(body ?? "");
      const forwarded = requests.at(-1);
      if (forwarded === undefined) throw new Error("Request did not reach API");
      expect(forwarded.url).toBe(new URL(path, origin).href);
      expect(forwarded.method).toBe(method);
      expect(forwarded.headers.get("origin")).toBe(headers.origin);
      expect(forwarded.headers.get("cookie")).toBe(headers.cookie);
    }

    for (const path of [
      "/api/author",
      "/api/report-images-other/id",
      "/api/me",
      "/login",
    ]) {
      expect((await fetch(new URL(path, origin))).status).toBe(404);
    }
    expect(requests).toHaveLength(4);
  } finally {
    await server?.close();
    await api.stop(true);
  }
});
