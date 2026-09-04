import { afterAll, describe, expect, test } from "vitest";

import { walkthroughServer } from "./walkthrough-server";

afterAll(() => walkthroughServer.cleanup());

describe("native Better Auth worker integration", () => {
  test("mounts the native auth route with request RuntimeContext", async () => {
    const response = await fetch(
      `${walkthroughServer.url}/api/auth/get-session`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("null");
  });

  test("provides the native auth service to application handlers", async () => {
    const response = await fetch(`${walkthroughServer.url}/api/me`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      _tag: "AuthenticationError",
      message: "unauthorized",
    });
  });

  test("executes a magic-link request through auth.fetch", async () => {
    const response = await fetch(
      `${walkthroughServer.url}/api/auth/sign-in/magic-link`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3005",
        },
        body: JSON.stringify({
          email: "native-wrapper@example.com",
          callbackURL: "http://localhost:3005",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: true });
  });
});
