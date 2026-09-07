/// <reference types="bun" />
import { expect, spyOn, test } from "bun:test";

import { forwardApiRequest } from "../src/lib/server/auth-proxy";

test("local proxy works without the Cloudflare runtime", async () => {
  const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("ok"),
  );
  try {
    const response = await forwardApiRequest(
      new Request("http://localhost:3005/api/auth/session"),
    );
    expect(await response.text()).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const forwarded = fetchSpy.mock.calls[0]?.[0];
    if (!(forwarded instanceof Request))
      throw new Error("Expected a forwarded request");
    expect(forwarded.url).toBe("http://localhost:1437/api/auth/session");
    expect(forwarded.headers.get("origin")).toBe("http://localhost:3005");
  } finally {
    fetchSpy.mockRestore();
  }
});
