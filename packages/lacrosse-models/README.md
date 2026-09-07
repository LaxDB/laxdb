# Lacrosse model studies

`@laxdb/lacrosse-models` is a standalone React/Vite viewer. It does not need Malvern, authentication, or the API server.

## Run

From the repository root:

```sh
bun install
infisical run --env=dev -- bun run --cwd packages/lacrosse-models dev
```

Open http://localhost:3011/.

The Mirage appears first, followed by the Warrior patent head. The flat mesh remains hidden. The viewer moved out of Malvern's `/blender` route.

## Files

- `src/`: interactive model viewer; styles import `@laxdb/ui/globals.css`.
- `scripts/`: Blender generators and shared geometry operations.
- `public/models/`: generated models, geometry check reports, and photo references.
- `assets/lacrosse/`: preserved complete stick, reference notes, patent PDF, drawings, and trace data.

The complete stick is frozen. Do not overwrite it when rebuilding the head studies.

## Rebuild models

From `packages/lacrosse-models`, with Blender 4.5 on PATH:

```sh
blender --background --python scripts/build-lacrosse.py
blender --background --python scripts/build-patent-head.py
```

Each generator runs its geometry checks before exporting. See `public/models/README.md` for sources and reconstruction limits.

## Check and build

From the repository root:

```sh
bun run --cwd packages/lacrosse-models typecheck
bun run --cwd packages/lacrosse-models lint
bun run --cwd packages/lacrosse-models build
```

Vite writes the static site to `dist/`. Use `bun run --cwd packages/lacrosse-models preview` to inspect it on port 3011 after stopping the development server.
