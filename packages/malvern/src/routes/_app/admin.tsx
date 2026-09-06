import { useAtomSet, RegistryContext } from "@effect/atom-react";
import { waitForQuery } from "@laxdb/reactivity/atom-query";
import { useAsyncQuery } from "@laxdb/reactivity/react";
import { useAsyncAction } from "@laxdb/reactivity/react-action";
import { Alert, AlertDescription } from "@laxdb/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@laxdb/ui/components/ui/alert-dialog";
import { Button } from "@laxdb/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@laxdb/ui/components/ui/card";
import { Input } from "@laxdb/ui/components/ui/input";
import { MultiSearchCombobox } from "@laxdb/ui/components/ui/search-combobox";
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
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";

import { authClient } from "../../lib/auth-client";
import {
  updateTeamAtom,
  teamsChanged,
  rosterChanged,
  recipientsChanged,
  teamsAtom,
  recipientsAtom,
  addRecipient,
  deleteTeam,
  removeRecipient,
  type RecipientView,
  type TeamView,
} from "../../lib/club";
import { membersChanged, membersAtom, type Member } from "../../lib/fines";
import {
  fixturesChanged,
  seasonsAtom,
  clubsAtom,
  competitionsAtom,
  importGamedayTeams,
  syncGamedayAssociationSeason,
  type GamedayTeamCompetitionView,
} from "../../lib/matches";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    if (
      context.me?.memberRole !== "owner" &&
      context.me?.memberRole !== "admin"
    ) {
      throw redirect({ to: "/fixtures" });
    }
  },
  component: Admin,
});

function ConfirmDialog({
  title,
  description,
  actionLabel,
  trigger,
  onConfirm,
}: {
  title: string;
  description?: string;
  actionLabel: string;
  trigger: ReactElement;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SectionError({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

function Admin() {
  const membersQuery = useAsyncQuery(membersAtom);
  const teamsQuery = useAsyncQuery(teamsAtom);
  const recipientsQuery = useAsyncQuery(recipientsAtom);

  const err = membersQuery.error ?? teamsQuery.error ?? recipientsQuery.error;

  const routeContext = Route.useRouteContext();
  const fetchedMembers = membersQuery.data ?? [];
  const members = useMemo(() => {
    const me = routeContext.me;
    if (
      !me?.activeMemberId ||
      !me.memberRole ||
      fetchedMembers.some((member) => member.id === me.activeMemberId)
    ) {
      return fetchedMembers;
    }
    return [
      {
        id: me.activeMemberId,
        userId: me.userId,
        role: me.memberRole,
        name: me.userName,
        email: me.userEmail,
      },
      ...fetchedMembers,
    ];
  }, [fetchedMembers, routeContext.me]);
  const teams = teamsQuery.data ?? [];
  const recipients = recipientsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Teams, report recipients, coaches, and player access.
        </p>
      </header>

      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err.message}</AlertDescription>
        </Alert>
      )}

      <Teams teams={teams} loading={teamsQuery.isLoading} />

      <Coaches
        teams={teams}
        members={members}
        loading={teamsQuery.isLoading || membersQuery.isLoading}
      />

      <Recipients teams={teams} recipients={recipients} />

      <Invite members={members} teams={teams} />
    </div>
  );
}

function Invite({
  members,
  teams,
}: {
  members: readonly Member[];
  teams: readonly TeamView[];
}) {
  const registry = useContext(RegistryContext);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [sent, setSent] = useState<string | null>(null);

  const inviteMutation = useAsyncAction(
    async (vars: { email: string; role: "member" | "admin" }) => {
      setSent(null);

      const result = await authClient.organization.inviteMember(vars);

      setSent(vars.email);
      setEmail("");

      return result;
    },
  );

  const removeMemberMutation = useAsyncAction(
    async (vars: { memberIdOrEmail: string }) => {
      const result = await authClient.organization.removeMember(vars);

      registry.update(membersChanged, (value) => value + 1);
      await waitForQuery(registry, membersAtom);

      return result;
    },
  );

  const send = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    inviteMutation.execute({ email: email.trim(), role });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Invite admins or players. A player becomes a coach when they are
          assigned to a team above.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SectionError
          error={inviteMutation.error ?? removeMemberMutation.error}
        />
        <form className="flex flex-wrap items-center gap-2" onSubmit={send}>
          <Input
            type="email"
            placeholder="player@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
            }}
            className="min-w-48 flex-1"
          />
          <Select
            items={[
              { value: "member", label: "player" },
              { value: "admin", label: "admin" },
            ]}
            value={role}
            onValueChange={(value: string | null) => {
              if (value === "member" || value === "admin") {
                setRole(value);
              }
            }}
          >
            <SelectTrigger className="min-w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">player</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending…" : "Invite"}
          </Button>
        </form>
        {sent && (
          <p className="text-xs text-muted-foreground">
            Invite sent to <strong className="text-foreground">{sent}</strong>.
            (Dev: check api worker logs.)
          </p>
        )}

        {members.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{memberLabel(m)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.email}
                  </TableCell>
                  <TableCell>{memberRoleLabel(m, teams)}</TableCell>
                  <TableCell className="text-right">
                    {m.role !== "owner" && (
                      <ConfirmDialog
                        title={`Remove ${memberLabel(m)}?`}
                        actionLabel="Remove"
                        trigger={
                          <Button
                            variant="destructive"
                            disabled={removeMemberMutation.isPending}
                          >
                            Remove
                          </Button>
                        }
                        onConfirm={() => {
                          removeMemberMutation.execute({
                            memberIdOrEmail: m.id,
                          });
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Coaches({
  teams,
  members,
  loading,
}: {
  teams: readonly TeamView[];
  members: readonly Member[];
  loading: boolean;
}) {
  // ponytail: one coach edit at a time; use per-team atoms for parallel edits.
  const { error, isFetching: isUpdating } = useAsyncQuery(updateTeamAtom);
  const update = useAtomSet(updateTeamAtom);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coaches</CardTitle>
        <CardDescription>
          Assign one coach to each squad. Invite them under People first if they
          are not listed here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SectionError error={error} />
        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading coaches…
          </p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Import a squad before assigning its coach.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Squad</TableHead>
                <TableHead>Assigned coach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>
                    <Select
                      items={[
                        { value: "", label: "Unassigned" },
                        ...members.map((member) => ({
                          value: member.id,
                          label: memberLabel(member),
                        })),
                      ]}
                      disabled={isUpdating}
                      value={team.coachMemberId ?? ""}
                      onValueChange={(value: string | null) => {
                        update({
                          id: team.id,
                          coachMemberId:
                            value === null || value === "" ? null : value,
                        });
                      }}
                    >
                      <SelectTrigger className="w-full max-w-72">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {memberLabel(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Teams({
  teams,
  loading,
}: {
  teams: readonly TeamView[];
  loading: boolean;
}) {
  const registry = useContext(RegistryContext);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedClubNames, setSelectedClubNames] = useState<readonly string[]>(
    [],
  );

  const seasonsQuery = useAsyncQuery(seasonsAtom);
  const seasons = seasonsQuery.data ?? [];

  useEffect(() => {
    if (selectedSeasonId !== "" || seasons.length === 0) return;
    setSelectedSeasonId(seasons[0]?.seasonId ?? "");
  }, [seasons, selectedSeasonId]);

  const clubsQuery = useAsyncQuery(
    selectedSeasonId === "" ? undefined : clubsAtom(selectedSeasonId),
  );
  const gamedayClubs = useMemo(() => {
    const seen = new Set<string>();
    return (clubsQuery.data ?? []).filter((club) => {
      const name = club.name.trim();
      if (name === "" || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [clubsQuery.data]);
  const competitionsQuery = useAsyncQuery(
    selectedSeasonId !== "" && selectedClubNames.length > 0
      ? competitionsAtom({
          seasonId: selectedSeasonId,
          clubNames: selectedClubNames,
        })
      : undefined,
  );

  const deleteMutation = useAsyncAction(async (vars: { id: string }) => {
    const result = await deleteTeam({ data: vars });

    registry.update(teamsChanged, (value) => value + 1);
    await waitForQuery(registry, teamsAtom);
    registry.update(fixturesChanged, (value) => value + 1);
    registry.update(rosterChanged, (value) => value + 1);
    registry.update(recipientsChanged, (value) => value + 1);
    await waitForQuery(registry, recipientsAtom);

    return result;
  });

  const associationSyncMutation = useAsyncAction(
    async (vars: { seasonId?: string; includeRosters?: boolean }) => {
      const result = await syncGamedayAssociationSeason({ data: vars });
      return result;
    },
  );

  const importMutation = useAsyncAction(
    async (vars: {
      seasonId: string;
      competitions: readonly GamedayTeamCompetitionView[];
    }) => {
      const result = await importGamedayTeams({
        data: {
          seasonId: vars.seasonId,
          teams: vars.competitions.map((competition) => ({
            compId: competition.compId,
            compName: competition.compName,
            teamId: competition.teamId,
            teamName: competition.teamName,
          })),
        },
      });

      registry.update(teamsChanged, (value) => value + 1);
      await waitForQuery(registry, teamsAtom);
      registry.update(fixturesChanged, (value) => value + 1);
      registry.update(rosterChanged, (value) => value + 1);

      return result;
    },
  );

  const competitions = competitionsQuery.data ?? [];
  const syncMsg = associationSyncMutation.data
    ? `Synced ${associationSyncMutation.data.sourceName} ${associationSyncMutation.data.seasonName}: ${associationSyncMutation.data.competitions} comps, ${associationSyncMutation.data.teams} teams, ${associationSyncMutation.data.fixtures} fixtures.`
    : null;
  const importMsg = importMutation.data
    ? `Linked ${importMutation.data.teams} squads, projected ${importMutation.data.fixtures} fixtures, and added ${importMutation.data.rosterPlayers} roster players.`
    : null;
  const err =
    seasonsQuery.error ??
    clubsQuery.error ??
    competitionsQuery.error ??
    deleteMutation.error ??
    associationSyncMutation.error ??
    importMutation.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Sync Lacrosse Victoria for the season, then link/import the GameDay
          squads Malvern appears under and assign local coaches.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SectionError error={err} />

        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner />
            Loading teams…
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[10rem_minmax(16rem,1fr)_auto] md:items-end">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Season</span>
                <Select
                  items={seasons.map((season) => ({
                    value: season.seasonId,
                    label: season.name,
                  }))}
                  value={selectedSeasonId}
                  onValueChange={(value: string | null) => {
                    setSelectedSeasonId(value ?? "");
                    setSelectedClubNames([]);
                  }}
                  disabled={seasonsQuery.isFetching && seasons.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.seasonId} value={season.seasonId}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  GameDay clubs/combined teams
                </span>
                <MultiSearchCombobox
                  items={gamedayClubs}
                  selectedValues={selectedClubNames}
                  onSelectedValuesChange={setSelectedClubNames}
                  getItemValue={(club) => club.name}
                  getItemLabel={(club) => club.name}
                  label="GameDay clubs/combined teams"
                  description="Select every GameDay name that Malvern appears under this season."
                  placeholder="Search/select GameDay names"
                  searchPlaceholder="Search GameDay names, e.g. Malvern or Brunswick"
                  loading={clubsQuery.isFetching && !clubsQuery.data}
                  loadingMessage={
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Loading GameDay clubs…
                    </span>
                  }
                  emptyMessage="Select a season to load GameDay club names."
                  noResultsMessage={(query) =>
                    `No GameDay names match “${query}”.`
                  }
                  disabled={clubsQuery.isFetching && !clubsQuery.data}
                  selectedSummary={(values) =>
                    values.length === 0
                      ? "Search/select GameDay names"
                      : `${values.length} GameDay name${
                          values.length === 1 ? "" : "s"
                        } selected`
                  }
                  footerSummary={(values) =>
                    values.length === 0
                      ? "No GameDay names selected."
                      : `${values.length} selected.`
                  }
                  renderFooterActions={({ searchQuery, close }) => (
                    <>
                      {gamedayClubs.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const search = searchQuery.trim();
                            const matcher = search === "" ? "malvern" : search;
                            setSelectedClubNames(
                              gamedayClubs
                                .filter((club) =>
                                  club.name
                                    .toLocaleLowerCase()
                                    .includes(matcher.toLocaleLowerCase()),
                                )
                                .map((club) => club.name),
                            );
                          }}
                        >
                          Select matches
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setSelectedClubNames([]);
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={close}
                      >
                        Done
                      </Button>
                    </>
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    associationSyncMutation.execute({
                      ...(selectedSeasonId !== "" && {
                        seasonId: selectedSeasonId,
                      }),
                      includeRosters: false,
                    });
                  }}
                  disabled={
                    selectedSeasonId === "" ||
                    associationSyncMutation.isPending ||
                    importMutation.isPending
                  }
                >
                  {associationSyncMutation.isPending
                    ? "Syncing league…"
                    : "Sync Lacrosse Victoria"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    importMutation.execute({
                      seasonId: selectedSeasonId,
                      competitions,
                    });
                  }}
                  disabled={
                    competitionsQuery.isFetching ||
                    importMutation.isPending ||
                    associationSyncMutation.isPending ||
                    selectedSeasonId === "" ||
                    competitions.length === 0
                  }
                >
                  {importMutation.isPending
                    ? "Importing…"
                    : competitionsQuery.isFetching
                      ? "Loading squads…"
                      : competitions.length > 0
                        ? `Link/import ${competitions.length} squads`
                        : "Link/import squads"}
                </Button>
              </div>
            </div>

            {syncMsg && (
              <p className="text-xs text-muted-foreground">{syncMsg}</p>
            )}
            {importMsg && (
              <p className="text-xs text-muted-foreground">{importMsg}</p>
            )}

            {teams.length === 0 ? (
              <p className="text-muted-foreground">
                Select a season and one or more GameDay names, then import
                squads to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Squad</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      onDelete={() => {
                        deleteMutation.execute({ id: team.id });
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const memberLabel = (member: Member) =>
  member.name.trim() === "" ? member.email : member.name;

const memberRoleLabel = (member: Member, teams: readonly TeamView[]) => {
  if (member.role === "owner" || member.role === "admin") return member.role;
  return teams.some((team) => team.coachMemberId === member.id)
    ? "coach"
    : "player";
};

function TeamRow({ team, onDelete }: { team: TeamView; onDelete: () => void }) {
  return (
    <TableRow>
      <TableCell>{team.name}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <ConfirmDialog
            title={`Delete ${team.name}?`}
            description="Fixtures go with it."
            actionLabel="Remove"
            trigger={<Button variant="destructive">Remove</Button>}
            onConfirm={onDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function Recipients({
  teams,
  recipients,
}: {
  teams: readonly TeamView[];
  recipients: readonly RecipientView[];
}) {
  const registry = useContext(RegistryContext);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");

  const addMutation = useAsyncAction(
    async (vars: { label: string; email: string; teamId: string | null }) => {
      const result = await addRecipient({ data: vars });

      setLabel("");
      setEmail("");
      setTeamId("");
      registry.update(recipientsChanged, (value) => value + 1);
      await waitForQuery(registry, recipientsAtom);

      return result;
    },
  );

  const removeMutation = useAsyncAction(async (vars: { id: string }) => {
    const result = await removeRecipient({ data: vars });

    registry.update(recipientsChanged, (value) => value + 1);
    await waitForQuery(registry, recipientsAtom);

    return result;
  });

  const teamOptions = useMemo(
    () => [
      { value: "", label: "All teams" },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
    [teams],
  );

  const teamName = (id: string | null) =>
    id === null
      ? "All teams"
      : (teams.find((team) => team.id === id)?.name ?? "—");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report recipients</CardTitle>
        <CardDescription>
          Who match reports get emailed to. Org-wide recipients apply to every
          team; team recipients only to theirs. Coaches choose from these when
          submitting.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SectionError error={addMutation.error ?? removeMutation.error} />
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !email.trim()) return;
            addMutation.execute({
              label: label.trim(),
              email: email.trim(),
              teamId: teamId || null,
            });
          }}
        >
          <Input
            placeholder='e.g. "Club secretary"'
            value={label}
            onChange={(e) => {
              setLabel(e.currentTarget.value);
            }}
            className="min-w-40 flex-1"
          />
          <Input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
            }}
            className="min-w-40 flex-1"
          />
          <Select
            items={teamOptions}
            value={teamId}
            onValueChange={(value: string | null) => {
              setTeamId(value ?? "");
            }}
          >
            <SelectTrigger className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="end"
              className="w-max min-w-(--anchor-width) max-w-[min(44rem,calc(100vw-2rem))]"
            >
              <SelectItem value="">All teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={addMutation.isPending}>
            Add
          </Button>
        </form>

        {recipients.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell>{recipient.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {recipient.email}
                  </TableCell>
                  <TableCell>{teamName(recipient.teamId)}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmDialog
                      title={`Remove ${recipient.label}?`}
                      actionLabel="Remove"
                      trigger={
                        <Button
                          variant="destructive"
                          disabled={removeMutation.isPending}
                        >
                          Remove
                        </Button>
                      }
                      onConfirm={() => {
                        removeMutation.execute({ id: recipient.id });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
