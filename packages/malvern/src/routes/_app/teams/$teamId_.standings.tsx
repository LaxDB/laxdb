import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import { Button } from "@laxdb/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@laxdb/ui/components/ui/card";
import { Spinner } from "@laxdb/ui/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@laxdb/ui/components/ui/table";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { TeamPageHeader } from "../../../components/team-page-header";
import { teamStandingsAtom } from "../../../lib/team-standings-atom";

export const Route = createFileRoute("/_app/teams/$teamId_/standings")({
  beforeLoad: ({ context, params }) => {
    const team = context.teams.find((entry) => entry.id === params.teamId);
    const canView =
      context.isAdmin ||
      (context.me?.activeMemberId !== null &&
        team?.coachMemberId === context.me?.activeMemberId);
    if (!canView) throw redirect({ to: "/teams" });
  },
  component: TeamStandingsPage,
});

function TeamStandingsPage() {
  const { teamId } = Route.useParams();
  const ctx = Route.useRouteContext();
  const team = ctx.teams.find((entry) => entry.id === teamId);
  const standingsResult = useAtomValue(teamStandingsAtom(teamId));
  const refreshStandings = useAtomRefresh(teamStandingsAtom(teamId));
  const standings = Option.getOrUndefined(AsyncResult.value(standingsResult));
  const error = Option.getOrUndefined(AsyncResult.error(standingsResult));
  const loading =
    standings === undefined &&
    (standingsResult.waiting || AsyncResult.isInitial(standingsResult));

  return (
    <div className="flex flex-col gap-8">
      <TeamPageHeader
        teamName={team?.name ?? "Team"}
        title="Standings"
        description="The published GameDay ladder for this team's current competition."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={refreshStandings}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> Loading standings…
        </p>
      )}

      {standings !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>{standings.compName}</CardTitle>
            <CardDescription>
              Cached {standings.fetchedAt.toLocaleString()}
              {standings.sourceUploadedAt === null
                ? ""
                : ` · GameDay uploaded ${standings.sourceUploadedAt}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pos</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>P</TableHead>
                  <TableHead>W</TableHead>
                  <TableHead>L</TableHead>
                  <TableHead>D</TableHead>
                  <TableHead>GF</TableHead>
                  <TableHead>GA</TableHead>
                  <TableHead>GD</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.rows.map((row) => (
                  <TableRow
                    key={`${row.position}:${row.teamName}`}
                    className={
                      row.gamedayTeamId === standings.gamedayTeamId
                        ? "bg-muted/55 font-medium"
                        : undefined
                    }
                  >
                    <TableCell>{row.position}</TableCell>
                    <TableCell>{row.teamName}</TableCell>
                    <TableCell>{row.played}</TableCell>
                    <TableCell>{row.wins}</TableCell>
                    <TableCell>{row.losses}</TableCell>
                    <TableCell>{row.draws}</TableCell>
                    <TableCell>{row.goalsFor}</TableCell>
                    <TableCell>{row.goalsAgainst}</TableCell>
                    <TableCell>{row.goalDifference}</TableCell>
                    <TableCell>{row.percentage.toFixed(2)}</TableCell>
                    <TableCell>{row.premiershipPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
