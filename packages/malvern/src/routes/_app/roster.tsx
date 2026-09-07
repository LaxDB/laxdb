import { RegistryContext } from "@effect/atom-react";
import { waitForQuery } from "@laxdb/frontend/reactivity/atom-query";
import { useAsyncQuery } from "@laxdb/frontend/reactivity/react";
import { useAsyncAction } from "@laxdb/frontend/reactivity/react-action";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Button } from "@laxdb/ui/components/ui/button";
import { Card, CardContent } from "@laxdb/ui/components/ui/card";
import { Input } from "@laxdb/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@laxdb/ui/components/ui/select";
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
import { createFileRoute } from "@tanstack/react-router";
import { useContext, useState } from "react";

import {
  rosterChanged,
  teamsAtom,
  rosterAtom,
  addRosterPlayer,
  updateRosterPlayer,
  type RosterPlayerView,
} from "../../lib/club";
import { syncGamedayRoster } from "../../lib/matches";
import { statsChanged } from "../../lib/stats";

export const Route = createFileRoute("/_app/roster")({
  validateSearch: (search) =>
    typeof search.teamId === "string" ? { teamId: search.teamId } : {},
  component: Roster,
});

function RosterRow({
  player,
  onSaved,
}: {
  readonly player: RosterPlayerView;
  readonly onSaved: () => Promise<unknown>;
}) {
  const [name, setName] = useState(player.name);
  const [jersey, setJersey] = useState(
    player.jerseyNumber === null ? "" : String(player.jerseyNumber),
  );
  const mutation = useAsyncAction(
    async (input: { readonly active?: boolean }) => {
      const result = await updateRosterPlayer({
        data: {
          id: player.id,
          name: name.trim(),
          jerseyNumber: jersey === "" ? null : Number(jersey),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
      });
      await onSaved();
      return result;
    },
  );

  return (
    <TableRow>
      <TableCell>
        <Input
          aria-label={`Jersey number for ${player.name}`}
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
          aria-label={`Name for ${player.name}`}
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
          className={cn(!player.active && "text-muted-foreground")}
        />
      </TableCell>
      <TableCell>{player.active ? "Active" : "Inactive"}</TableCell>
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
              mutation.execute({ active: !player.active });
            }}
          >
            {player.active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Roster() {
  const routeContext = Route.useRouteContext();
  const registry = useContext(RegistryContext);
  const search = Route.useSearch();

  const [pickedTeamId, setPickedTeamId] = useState(search.teamId ?? "");
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");

  const teamsQuery = useAsyncQuery(teamsAtom);
  const teams = teamsQuery.data ?? [];
  const activeMemberId = routeContext.me?.activeMemberId ?? null;
  const availableTeams = routeContext.isAdmin
    ? teams
    : teams.filter((team) => team.coachMemberId === activeMemberId);
  const pickedTeamIsAvailable = availableTeams.some(
    (team) => team.id === pickedTeamId,
  );
  const teamId = pickedTeamIsAvailable
    ? pickedTeamId
    : (availableTeams.at(0)?.id ?? "");

  const rosterQuery = useAsyncQuery(
    teamId === "" ? undefined : rosterAtom(teamId),
  );
  const roster = rosterQuery.data ?? [];

  const invalidateRoster = () => {
    registry.update(rosterChanged, (value) => value + 1);
    registry.update(statsChanged, (value) => value + 1);
    return waitForQuery(registry, rosterAtom(teamId));
  };

  const addPlayer = useAsyncAction(
    async (vars: {
      teamId: string;
      name: string;
      jerseyNumber: number | null;
    }) => {
      const result = await addRosterPlayer({ data: vars });

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

  const err =
    teamsQuery.error ??
    rosterQuery.error ??
    addPlayer.error ??
    syncRoster.error;

  const add = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || teamId === "") return;
    addPlayer.execute({
      teamId,
      name: name.trim(),
      jerseyNumber: jersey === "" ? null : Number(jersey),
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
          <p className="text-sm text-muted-foreground">
            Players available when submitting match reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {routeContext.isAdmin && teamId !== "" && (
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
          )}
          {availableTeams.length > 1 && (
            <Select
              items={availableTeams.map((team) => ({
                value: team.id,
                label: team.name,
              }))}
              value={teamId}
              onValueChange={(value: string | null) => {
                if (value !== null) setPickedTeamId(value);
              }}
            >
              <SelectTrigger className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {syncRoster.data && (
        <p className="text-sm text-muted-foreground">
          Fetched {syncRoster.data.fetched}; created {syncRoster.data.created},
          linked {syncRoster.data.linked}, already linked{" "}
          {syncRoster.data.existing}, unresolved {syncRoster.data.unresolved}.
        </p>
      )}

      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err.message}</AlertDescription>
        </Alert>
      )}

      {teamsQuery.data !== undefined && availableTeams.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              {teams.length === 0
                ? "No teams set up yet. An admin needs to create your team under Admin."
                : "You are not assigned as coach of any teams yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <form className="flex flex-wrap items-center gap-2" onSubmit={add}>
              <Input
                placeholder="Player name"
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
                className="min-w-48 flex-[2]"
              />
              <Input
                type="number"
                min="0"
                placeholder="#"
                value={jersey}
                onChange={(e) => {
                  setJersey(e.currentTarget.value);
                }}
                className="min-w-16 flex-1"
              />
              <Button type="submit" disabled={addPlayer.isPending}>
                Add player
              </Button>
            </form>

            {rosterQuery.isLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Spinner />
                Loading…
              </p>
            ) : roster.length === 0 ? (
              <p className="text-muted-foreground">No players yet.</p>
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
                  {roster.map((player) => (
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
      )}
    </div>
  );
}
