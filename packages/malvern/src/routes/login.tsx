import { useAsyncAction } from "@laxdb/frontend/atom-action";
import { authClient } from "@laxdb/frontend/auth";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Button } from "@laxdb/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@laxdb/ui/components/ui/card";
import { Input } from "@laxdb/ui/components/ui/input";
import { Spinner } from "@laxdb/ui/components/ui/spinner";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");

  const googleSignIn = useAsyncAction(() =>
    authClient.signIn.social({ provider: "google", callbackURL: "/" }),
  );

  const sendLink = useAsyncAction(async (address: string) => {
    await authClient.signIn.magicLink({ email: address, callbackURL: "/" });
    return address;
  });

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || sendLink.isPending) return;
    sendLink.execute(trimmed);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Continue with Google or get a magic link by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              size="lg"
              disabled={googleSignIn.isPending}
              onClick={() => {
                googleSignIn.execute();
              }}
            >
              {googleSignIn.isPending && <Spinner />}
              {googleSignIn.isPending ? "Redirecting…" : "Continue with Google"}
            </Button>

            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form className="flex flex-col gap-3" onSubmit={submit}>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
              />
              <Button type="submit" size="lg" disabled={sendLink.isPending}>
                {sendLink.isPending && <Spinner />}
                {sendLink.isPending
                  ? "Generating…"
                  : sendLink.isSuccess
                    ? "Resend magic link"
                    : "Send magic link"}
              </Button>
            </form>

            {sendLink.isSuccess && (
              <Alert>
                <AlertDescription>
                  Magic link generated for <strong>{sendLink.data}</strong>. In
                  local mode, check the api worker logs; no email is sent.
                </AlertDescription>
              </Alert>
            )}

            {(googleSignIn.error !== undefined ||
              sendLink.error !== undefined) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {googleSignIn.error?.message ?? sendLink.error?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
