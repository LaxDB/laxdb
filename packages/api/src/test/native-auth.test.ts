import { afterAll, describe, expect, test, vi } from "vitest";

import { deliverAuthEmail } from "../auth/auth";

import { walkthroughDatabase, walkthroughServer } from "./walkthrough-server";

afterAll(() => walkthroughServer.cleanup());

describe("native Better Auth worker integration", () => {
  test("does not log auth links when production email is unavailable", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await expect(
        deliverAuthEmail(
          { IS_LOCAL: "" },
          {
            to: "user@example.com",
            subject: "Sign in",
            intro: "Use this link.",
            linkLabel: "Sign in",
            link: "https://example.com/magic?token=secret",
          },
        ),
      ).rejects.toThrow("RESEND_API_KEY is required outside local development");
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test("completes sign-in and handles stale auth state", async () => {
    const email = "native-wrapper@example.com";
    let emailMessage: string | undefined;
    const log = vi
      .spyOn(console, "log")
      .mockImplementation((value: unknown) => {
        if (
          typeof value === "string" &&
          value.startsWith(`[email:dev] to=${email}`)
        ) {
          emailMessage = value;
        }
      });

    try {
      const signInResponse = await fetch(
        `${walkthroughServer.url}/api/auth/sign-in/magic-link`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3005",
          },
          body: JSON.stringify({
            email,
            callbackURL: "http://localhost:3005",
          }),
        },
      );

      expect(signInResponse.status).toBe(200);
      expect(await signInResponse.json()).toEqual({ status: true });
    } finally {
      log.mockRestore();
    }

    if (emailMessage === undefined) {
      throw new Error("Magic-link email was not logged in local mode");
    }

    const linkMarker = " link=";
    const linkIndex = emailMessage.indexOf(linkMarker);
    if (linkIndex < 0) throw new Error("Magic-link log has no link");

    const magicLink = new URL(
      emailMessage.slice(linkIndex + linkMarker.length),
    );
    const verificationUrl = new URL(
      `${magicLink.pathname}${magicLink.search}`,
      walkthroughServer.url,
    );
    const verificationResponse = await fetch(verificationUrl, {
      redirect: "manual",
    });

    expect(verificationResponse.status).toBe(302);
    const setCookie = verificationResponse.headers.get("set-cookie");
    if (setCookie === null) {
      throw new Error("Magic-link verification did not set a session cookie");
    }
    const sessionCookie = setCookie.split(";", 1)[0];
    if (sessionCookie === undefined) {
      throw new Error("Magic-link verification returned an invalid cookie");
    }

    const expectedSession = {
      userName: "",
      userEmail: email,
      activeOrganizationId: null,
      activeMemberId: null,
      memberRole: null,
    };
    const sessionResponse = await fetch(`${walkthroughServer.url}/api/me`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie,
      },
      body: "{}",
    });

    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject(expectedSession);

    await walkthroughDatabase
      .prepare(
        "UPDATE session SET active_organization_id = ? WHERE user_id = (SELECT id FROM user WHERE email = ?)",
      )
      .bind("deleted-organization", email)
      .run();

    const staleMembershipResponse = await fetch(
      `${walkthroughServer.url}/api/me`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: sessionCookie,
        },
        body: "{}",
      },
    );

    expect(staleMembershipResponse.status).toBe(200);
    expect(await staleMembershipResponse.json()).toMatchObject(expectedSession);

    await walkthroughDatabase
      .prepare(
        "UPDATE session SET expires_at = ? WHERE user_id = (SELECT id FROM user WHERE email = ?)",
      )
      .bind(Date.now() + 60_000, email)
      .run();
    await walkthroughDatabase
      .prepare(
        [
          "CREATE TRIGGER delete_session_during_refresh",
          "BEFORE UPDATE ON session",
          "BEGIN",
          "DELETE FROM session WHERE id = OLD.id;",
          "SELECT RAISE(IGNORE);",
          "END",
        ].join(" "),
      )
      .run();

    try {
      const deletedSessionResponse = await fetch(
        `${walkthroughServer.url}/api/me`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: sessionCookie,
          },
          body: "{}",
        },
      );

      expect(deletedSessionResponse.status).toBe(401);
      expect(await deletedSessionResponse.json()).toEqual({
        _tag: "AuthenticationError",
        message: "unauthorized",
      });
    } finally {
      await walkthroughDatabase
        .prepare("DROP TRIGGER IF EXISTS delete_session_during_refresh")
        .run();
    }
  });
});
