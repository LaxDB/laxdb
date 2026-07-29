import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("homepage editorial shell", () => {
  it("uses the World LaxDB masthead identity", () => {
    const header = readFileSync(
      new URL("../src/components/tournament-header.tsx", import.meta.url),
      "utf8",
    );

    expect(header).toContain("world.laxdb");
    expect(header).toContain('src="/favicon.svg"');
    expect(header).toContain('aria-label="World LaxDB home"');
  });

  it("keeps the homepage purpose concise and retains the resource footer", () => {
    const pages = readFileSync(
      new URL("../src/pages/tournament-pages.tsx", import.meta.url),
      "utf8",
    );

    expect(pages).toContain(
      "Schedules, results, standings, player statistics, and deeper game",
    );
    expect(pages).not.toContain("Deeper coverage. A lasting record.");
    expect(pages).not.toContain('className="home-statistics-preview"');

    const footer = readFileSync(
      new URL("../src/components/home-footer.tsx", import.meta.url),
      "utf8",
    );
    expect(footer).toContain('className="home-footer"');
    expect(footer).toContain("Championship resources");

    const rootRoute = readFileSync(
      new URL("../src/routes/__root.tsx", import.meta.url),
      "utf8",
    );
    expect(rootRoute).toContain("<HomeFooter />");
  });

  it("uses the shared page title and avoids native abbreviation tooltips", () => {
    const pages = readFileSync(
      new URL("../src/pages/tournament-pages.tsx", import.meta.url),
      "utf8",
    );

    expect(pages).not.toContain("compactTitle");
    expect(pages).toContain('<header className="page-title">');
    expect(pages).toContain('followed ? "button-primary" : "button-secondary"');
    expect(pages).not.toContain("<StatAbbreviation");
  });
});
