import { cn } from "@laxdb/ui/lib/utils";

export function FollowTeamButton({
  teamId,
  teamName,
  followed,
  onToggle,
}: {
  readonly teamId: string;
  readonly teamName: string;
  readonly followed: boolean;
  readonly onToggle: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "follow-team-button",
        "button-compact",
        followed ? "button-primary" : "button-secondary",
      )}
      aria-pressed={followed}
      aria-label={`${followed ? "Stop following" : "Follow"} ${teamName}`}
      onClick={() => {
        onToggle(teamId);
      }}
    >
      {followed ? "Following" : "Follow"}
    </button>
  );
}
