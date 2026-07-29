import { readFileSync } from "node:fs";

import type { ColumnDef } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTable } from "../src/components/data-table";

interface Row {
  readonly name: string;
}

const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];

describe("public site shell", () => {
  it("uses the shared LaxDB favicon and championship defaults", () => {
    const index = readFileSync(
      new URL("../index.html", import.meta.url),
      "utf8",
    );
    const favicon = readFileSync(
      new URL("../public/favicon.svg", import.meta.url),
      "utf8",
    );
    const sharedFavicon = readFileSync(
      new URL("../../ui/src/assets/favicon.svg", import.meta.url),
      "utf8",
    );

    expect(index).toContain('href="/favicon.svg"');
    expect(index).toContain('name="theme-color" content="#f6f3ea"');
    expect(index).toContain(
      "Scores, schedules, standings, statistics, and match analysis",
    );
    expect(favicon).toBe(sharedFavicon);
  });

  it("keeps complete navigation with a skip link", () => {
    const header = readFileSync(
      new URL("../src/components/tournament-header.tsx", import.meta.url),
      "utf8",
    );

    expect(header).toContain('href="#main-content"');
    for (const destination of [
      "/schedule",
      "/standings",
      "/statistics",
      "/analysis",
      "/format",
    ])
      expect(header).toContain(`to="${destination}"`);
    expect(header).not.toContain('to="/teams"');
    expect(header).toContain("2026-world-lacrosse-womens-championship/");
    expect(header).not.toContain("<span />");
    const router = readFileSync(
      new URL("../src/router.ts", import.meta.url),
      "utf8",
    );
    expect(router).toContain('import { routeTree } from "./routeTree.gen"');
    expect(router).not.toContain("createRoute(");

    const teamsRoute = readFileSync(
      new URL("../src/routes/teams/index.tsx", import.meta.url),
      "utf8",
    );
    expect(teamsRoute).toContain('redirect({ to: "/standings"');

    const aboutRoute = readFileSync(
      new URL("../src/routes/about.tsx", import.meta.url),
      "utf8",
    );
    expect(aboutRoute).toContain('createFileRoute("/about")');

    const footer = readFileSync(
      new URL("../src/components/home-footer.tsx", import.meta.url),
      "utf8",
    );
    expect(footer).toContain('to="/about"');
    expect(footer).toContain("https://laxdb.io/");

    const rootRoute = readFileSync(
      new URL("../src/routes/__root.tsx", import.meta.url),
      "utf8",
    );
    expect(rootRoute).toContain("<Outlet />");
    expect(rootRoute).toContain("<HomeFooter />");
  });

  it("exposes sorting and horizontal-table semantics", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={columns}
        data={[{ name: "Australia" }]}
        searchPlaceholder="Search teams…"
        descriptionId="table-guide"
      />,
    );

    expect(markup).toContain('aria-sort="none"');
    expect(markup).toContain('aria-label="Statistics table"');
    expect(markup).toContain('aria-describedby="table-guide"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain(">Search<");
    expect(markup).toContain("1 records");
  });

  it("labels the full-screen table workspace without claiming modality", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={columns}
        data={[{ name: "Australia" }]}
        searchPlaceholder="Search teams…"
        fullscreen
        onFullscreenChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-fullscreen="true"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Full-screen statistics table"');
    expect(markup).not.toContain("aria-modal");
    expect(markup).toContain("Exit full screen");
    expect(markup).toContain(
      'aria-keyshortcuts="Meta+Shift+F Control+Shift+F"',
    );

    const statisticsPage = readFileSync(
      new URL("../src/pages/statistics-page.tsx", import.meta.url),
      "utf8",
    );
    expect(statisticsPage).toContain("fullscreen={tableFullscreen}");
    expect(statisticsPage).toContain("onFullscreenChange={setTableFullscreen}");
    expect(statisticsPage).toContain("toolbarLeading={viewSwitcher}");
    expect(statisticsPage).toContain("filterLabels={statisticsFilterLabels}");
    expect(statisticsPage).not.toContain("setTeamFilter");
    expect(statisticsPage).not.toContain("setPoolFilter");
  });
});
