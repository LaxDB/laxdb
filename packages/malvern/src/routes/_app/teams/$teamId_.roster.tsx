import { RegistryContext } from "@effect/atom-react";
import { waitForQuery } from "@laxdb/reactivity/atom-query";
import { useAsyncQuery } from "@laxdb/reactivity/react";
import { useAsyncAction } from "@laxdb/reactivity/react-action";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Button } from "@laxdb/ui/components/ui/button";
import { Card, CardContent } from "@laxdb/ui/components/ui/card";
import { Input } from "@laxdb/ui/components/ui/input";
import { Spinner } from "@laxdb/ui/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@laxdb/ui/components/ui/table";
import { cn } from "@laxdb/ui/lib/utils";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useContext, useState } from "react";

import { TeamPageHeader } from "../../../components/team-page-header";
import {
  rosterChanged,
  rosterAtom,
  addRosterPlayer,
  updateRosterPlayer,
  type RosterPlayerView,
} from "../../../lib/club";
import { syncGamedayRoster } from "../../../lib/matches";
import { statsChanged } from "../../../lib/stats";

export const Route = createFileRoute("/_app/teams/$teamId_/roster")({
  beforeLoad: ({ context, params }) => {
    const team = context.teams.find((entry) => entry.id === params.teamId);
    const canView =
      context.isAdmin ||
      (context.me?.activeMemberId !== null &&
        team?.coachMemberId === context.me?.activeMemberId);
    if (!canView) throw redirect({ to: "/teams" });
  },
  component: TeamRosterPage,
});

function RosterRow(props: {
  readonly player: RosterPlayerView;
  readonly onSaved: () => Promise<unknown>;
}) {
  const [name, setName] = useState(props.player.name);
  const [jersey, setJersey] = useState(
    props.player.jerseyNumber === null ? "" : String(props.player.jerseyNumber),
  );
  const mutation = useAsyncAction(
    async (input: { readonly active?: boolean }) => {
      const result = await updateRosterPlayer({
        data: {
          id: props.player.id,
          name: name.trim(),
          jerseyNumber: jersey === "" ? null : Number(jersey),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
      });
      await props.onSaved();
      return result;
    },
  );

  return (
    <TableRow>
      <TableCell>
        <Input
          aria-label={`Jersey number for ${props.player.name}`}
          type="number"
          min="0"
          value={jersey}
          onChange={(event) => {
            setJersey(event.currentTarget.value);
          }}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label={`Name for ${props.player.name}`}
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
          className={cn(!props.player.active && "text-muted-foreground")}
        />
      </TableCell>
      <TableCell>{props.player.active ? "Active" : "Inactive"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={mutation.isPending || name.trim() === ""}
            onClick={() => {
              mutation.execute({});
            }}
          >
            Save
          </Button>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.execute({ active: !props.player.active });
            }}
          >
            {props.player.active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TeamRosterPage() {
  const { teamId } = Route.useParams();
  const context = Route.useRouteContext();
  const team = context.teams.find((entry) => entry.id === teamId);
  const registry = useContext(RegistryContext);
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");

  const rosterQuery = useAsyncQuery(rosterAtom(teamId));
  const invalidateRoster = () => {
    registry.update(rosterChanged, (value) => value + 1);
    registry.update(statsChanged, (value) => value + 1);
    return waitForQuery(registry, rosterAtom(teamId));
  };
  const addPlayer = useAsyncAction(
    async (input: { name: string; jerseyNumber: number | null }) => {
      const result = await addRosterPlayer({ data: { teamId, ...input } });

      setName("");
      setJersey("");
      await invalidateRoster();

      return result;
    },
  );
  const syncRoster = useAsyncAction(async () => {
    const result = await syncGamedayRoster({ data: { teamId } });
    await invalidateRoster();
    return result;
  });
  const error = rosterQuery.error ?? addPlayer.error ?? syncRoster.error;

  const add = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    addPlayer.execute({
      name: name.trim(),
      jerseyNumber: jersey === "" ? null : Number(jersey),
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <TeamPageHeader
        teamName={team?.name ?? "Team"}
        title="Roster"
        description="Sync GameDay players, then add or edit local roster details whenever needed."
        actions={
          context.isAdmin ? (
            <Button
              type="button"
              variant="outline"
              disabled={syncRoster.isPending}
              onClick={() => {
                syncRoster.execute();
              }}
            >
              {syncRoster.isPending ? "Syncing…" : "Sync GameDay roster"}
            </Button>
          ) : null
        }
      />

      {syncRoster.data && (
        <p className="text-sm text-muted-foreground">
          Fetched {syncRoster.data.fetched}; created {syncRoster.data.created},
          linked {syncRoster.data.linked}, already linked{" "}
          {syncRoster.data.existing}, unresolved {syncRoster.data.unresolved}.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-2" onSubmit={add}>
            <Input
              placeholder="Player name"
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
              className="min-w-48 flex-[2]"
            />
            <Input
              type="number"
              min="0"
              placeholder="#"
              value={jersey}
              onChange={(event) => {
                setJersey(event.currentTarget.value);
              }}
              className="min-w-16 flex-1"
            />
            <Button type="submit" disabled={addPlayer.isPending}>
              Add player
            </Button>
          </form>

          {rosterQuery.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner /> Loading roster…
            </p>
          ) : (rosterQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">
              No players yet. Sync GameDay or add the first player manually.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rosterQuery.data ?? []).map((player) => (
                  <RosterRow
                    key={player.id}
                    player={player}
                    onSaved={invalidateRoster}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
