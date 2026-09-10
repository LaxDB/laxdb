import { useAsyncAction } from "@laxdb/frontend/atom-action";
import { authClient } from "@laxdb/frontend/auth";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Card, CardContent } from "@laxdb/ui/components/ui/card";
import { Spinner } from "@laxdb/ui/components/ui/spinner";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/accept-invitation/$id")({
  component: Accept,
});

function Accept() {
  const { id } = Route.useParams();
  const router = useRouter();

  const accept = useAsyncAction(async (invitationId: string) => {
    const session = await authClient.getSession();
    if (!session) return { needLogin: true };
    await authClient.organization.acceptInvitation({ invitationId });
    // Replace the document so no previous user's cache survives the identity change.
    await router.navigate({ to: "/fines", reloadDocument: true });
    return { needLogin: false };
  });

  const { execute: mutate } = accept;
  useEffect(() => {
    mutate(id);
  }, [mutate, id]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Accept invitation
        </h1>
        {(accept.isPending || accept.isIdle) && (
          <p className="flex items-center gap-2 text-xs/relaxed text-muted-foreground">
            <Spinner className="size-3.5" />
            Checking…
          </p>
        )}
        {accept.data?.needLogin === true && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p>Sign in first to accept this invitation.</p>
              <a
                className="w-fit underline underline-offset-4 hover:text-foreground"
                href={`/login?next=/accept-invitation/${id}`}
              >
                Go to sign in →
              </a>
            </CardContent>
          </Card>
        )}
        {accept.data?.needLogin === false && (
          <p className="text-xs/relaxed">Joined. Redirecting…</p>
        )}
        {accept.error !== undefined && (
          <Alert variant="destructive">
            <AlertDescription>{accept.error.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
