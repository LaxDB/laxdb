---
version: alpha
name: LaxDB
description: Lacrosse operating system for clubs, teams, practices, and player development.
colors:
  background: "oklch(0.96 0.007 70)"
  foreground: "oklch(0.17 0 0)"
  card: "oklch(1 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.51 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  accent: "oklch(0.91 0 0)"
  accent-foreground: "oklch(0.17 0 0)"
  brand-accent: "oklch(0.603432 0.234297 27.067937)"
  brand-accent-foreground: "oklch(0 0 0)"
  success: "oklch(0.55 0.15 145)"
  warning: "oklch(0.75 0.18 70)"
  destructive: "oklch(0.58 0.22 27)"
typography:
  h1:
    fontFamily: Newsreader
    fontSize: 4rem
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  h2:
    fontFamily: Newsreader
    fontSize: 2.5rem
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.035em"
  body:
    fontFamily: Helvetica Neue
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.75
  label-caps:
    fontFamily: Helvetica Neue
    fontSize: 0.75rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: 12px
  button-brand:
    backgroundColor: "{colors.brand-accent}"
    textColor: "{colors.brand-accent-foreground}"
    rounded: "{rounded.md}"
    padding: 12px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  secondary-panel:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
  selection:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.sm}"
  status-success:
    textColor: "{colors.success}"
  status-warning:
    textColor: "{colors.warning}"
  status-destructive:
    textColor: "{colors.destructive}"
---

## Scope

Use this file as the design judgment contract for LaxDB product and marketing work. Runtime tokens remain in `packages/ui/src/globals.css`. Shared components remain in `packages/ui/src/components`. Do not generate another runtime stylesheet from this file.

LaxDB should feel like a serious coaching notebook crossed with a modern operating console. It must be tactile, editorial, sharp, and field-ready.

## Reader and task

Structure each page around the task that brought the reader there. Do not start from a dashboard template.

- Coaches need the next fixture, player, statistic, or report action quickly.
- Club administrators need broad status, clear exceptions, and safe bulk actions.
- Players and parents need direct answers without administrative detail.
- Marketing readers need the claim first, evidence second, and detail on demand.

For Malvern, treat the completed-fixture flow as a field workflow. A coach records statistics, selects the best players, writes the match report, and adds photos. Keep local statistics visibly separate from GameDay data.

## Information hierarchy

- Put the reader's next action or decision in the first useful section.
- Keep the page title, current team, fixture, and state visible without repeating them in helper text.
- Show summaries before detailed records, but do not hide operational data behind decorative cards.
- Let tables, rosters, stat entry, and comparison evidence use the full available width.
- Keep primary and destructive actions visually distinct. Use club red only when it adds meaning.
- Preserve facts and caveats. Never improve appearance by removing required data.

## Composition

Use generous spacing on marketing pages. Use tighter, tool-like spacing in club and practice workflows.

Prefer clear zones and useful asymmetry over centered card stacks. Preserve strong alignment for tables, rosters, drills, fixtures, and schedule data. On planning surfaces, keep the field or canvas visually dominant.

Use borders, surface contrast, and slight shadows for depth. Do not use glassmorphism or heavy blur. Use modest corners. Reserve pills for tags, status, and compact metadata.

## Typography

Use `Newsreader` for editorial headings and high-impact moments. Use `Helvetica Neue` for controls, forms, tables, and dense workflows.

Headlines should be compressed and confident. Interface text should be neutral and quick to scan. Use tabular numbers for scores, times, and statistics.

## Color

The palette is warm and grounded. Use parchment backgrounds, deep ink text, restrained borders, and one club-red brand accent.

`accent` is a neutral interaction surface. `brand-accent` is Malvern red. Do not use these names as synonyms.

Use semantic success, warning, and destructive colors only for their named state. Do not use them as decoration.

## Copy

- Use lacrosse terms such as fixture, roster, squad, report, and best on ground.
- Start buttons with a direct verb: Save statistics, Submit report, Sync team.
- State the result of an action. Do not use vague success messages.
- Put caveats next to the data or action they qualify.
- Do not add a subtitle that repeats its heading.

## Responsive behavior

- Make the main task usable on a 390px-wide screen without page-level horizontal scrolling.
- Let data tables scroll inside their own container when columns cannot collapse safely.
- Stack form sections in task order on small screens.
- Keep labels with their controls and actions near the data they change.
- Do not remove data on mobile. Change its presentation.

## Available primitives

Import global styles through `@laxdb/ui/globals.css`. Use shared Base UI components from `@laxdb/ui/components/ui/*`; do not copy them into an app.

Prefer these existing primitives:

- `Button` for actions. Use `default` for the main action and `destructive` for irreversible actions.
- `Card` for one bounded work unit, not every piece of content.
- `Table` for records and comparisons. Its container already supplies local horizontal scrolling.
- `Field`, `Label`, `Input`, `Select`, and `Textarea` for forms.
- `Alert`, `Badge`, `Spinner`, and `Skeleton` for state.
- `DataTable` for large filterable records.

Use semantic Tailwind utilities such as `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, and `bg-brand-accent`. Do not add raw colors in app code.

## Named failures

- **Card carpet:** Every fact sits in an equal card, so no task or result leads.
- **Clubhouse dashboard:** A generic SaaS grid replaces the club's real workflow.
- **Red confetti:** Club red marks decoration instead of a meaningful action or state.
- **Context echo:** A subtitle repeats the page title, team, or section label.
- **Table squeeze:** A record table stays at prose width although more width is available.
- **Desktop shrink:** A desktop row only becomes smaller on mobile instead of changing structure.
- **Mystery state:** Color or an icon carries status without a clear text label.

## Review rules

Every design correction must describe an observable result. Put judgment here, reusable mechanics in `@laxdb/ui`, and deterministic checks in code.

Before accepting visual work, confirm that:

- the reader's task is clear;
- supplied facts remain present;
- primary actions and system state are clear;
- the page works at desktop and mobile widths;
- shared tokens and components are used;
- none of the named failures appear.

Run `bun run design:lint` after edits to this file.
