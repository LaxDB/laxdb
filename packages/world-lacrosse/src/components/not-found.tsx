import { PageMetadata } from "./page-metadata";

export function NotFound({
  resource = "Page",
  actionHref = "/",
  actionLabel = "Return home",
}: {
  readonly resource?: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
}) {
  return (
    <main className="not-found">
      <PageMetadata
        title={`${resource} not found`}
        description={`The requested ${resource.toLowerCase()} could not be found.`}
      />
      <span>404</span>
      <h1>{resource} not found</h1>
      <a href={actionHref}>{actionLabel}</a>
    </main>
  );
}
