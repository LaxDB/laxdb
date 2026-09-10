import { useAsyncAction } from "@laxdb/frontend/atom-action";
import { useAsyncQuery } from "@laxdb/frontend/atom-query";
import { authClient, organizationsAtom } from "@laxdb/frontend/auth";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Button } from "@laxdb/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@laxdb/ui/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@laxdb/ui/components/ui/field";
import { Input } from "@laxdb/ui/components/ui/input";
import { Spinner } from "@laxdb/ui/components/ui/spinner";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // A session can land here without an active organization (e.g. sessions
  // created before the activate-on-login hook). If the user already belongs
  // to one, re-activate it instead of offering to create a duplicate.
  const memberships = useAsyncQuery(organizationsAtom);

  const rejoin = useAsyncAction(async (organizationId: string) => {
    await authClient.organization.setActive({ organizationId });

    await router.navigate({ to: "/fines", reloadDocument: true });
  });

  const existingOrg = memberships.data?.[0];
  const existingOrgId = existingOrg?.id;
  const { execute: rejoinMutate } = rejoin;
  useEffect(() => {
    if (existingOrgId !== undefined) rejoinMutate(existingOrgId);
  }, [existingOrgId, rejoinMutate]);

  const createTeam = useAsyncAction(
    async (input: { name: string; slug: string }) => {
      const org = await authClient.organization.create({
        name: input.name,
        slug: input.slug || slugify(input.name),
      });
      await authClient.organization.setActive({ organizationId: org.id });

      await router.navigate({ to: "/fines", reloadDocument: true });
    },
  );

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || createTeam.isPending) return;
    createTeam.execute({ name: trimmedName, slug: slug.trim() });
  };

  if (memberships.isLoading || existingOrg !== undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-xs/relaxed text-muted-foreground">
              <Spinner className="size-3.5" />
              {existingOrg === undefined
                ? "Checking memberships…"
                : `Rejoining ${existingOrg.name}…`}
            </p>
            {rejoin.error !== undefined && (
              <Alert variant="destructive">
                <AlertDescription>{rejoin.error.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your team</CardTitle>
          <CardDescription>
            You're the first one here — set up the team, then invite players.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="team-name">Team name</FieldLabel>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  placeholder="Malvern Lacrosse Club"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="team-slug">URL slug (optional)</FieldLabel>
                <Input
                  id="team-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                  }}
                  placeholder="malvern-lacrosse"
                />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" disabled={createTeam.isPending}>
              {createTeam.isPending && <Spinner />}
              {createTeam.isPending ? "Creating…" : "Create team"}
            </Button>
            {createTeam.error !== undefined && (
              <Alert variant="destructive">
                <AlertDescription>{createTeam.error.message}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
