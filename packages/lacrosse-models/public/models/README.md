# Head reference studies

The standalone `@laxdb/lacrosse-models` viewer contains two interactive bare heads: the photo-based Mirage 3.0 and the Warrior US D707770 S patent study. Desktop places the patent head after the Mirage; mobile stacks the models in that order. No mesh or page controls are displayed.

Blender creates the assets; model-viewer displays their GLBs.

The complete stick is frozen in `packages/lacrosse-models/assets/lacrosse/complete-stick-v4.blend` and `.glb`. The current builder cannot overwrite those files.

`head-study.blend` contains separate bare-head and mesh collections. `mirage-head.glb` is the visible study. `mirage-mesh.glb` is a separate flat sheet, retained but not displayed. Its 200 identical elongated hexagonal cells share edges; it is not stretched or fitted into the head. The 10 × 18 mm cell dimensions are modeling assumptions.

`patent-d707770.blend` and `.glb` contain the first patent embodiment, Figures 1–6. The source PDF, enhanced drawing sheets, trace coordinates, and reconstruction limits are in `packages/lacrosse-models/assets/lacrosse/patent-d707770/`.

Both studies are reconstructions, not manufacturer CAD. No customization system is included.

## Photo sources

Viewed front, side, three-quarter, stringing, throat, and inner-sidewall photographs. Retrieved 2026-09-06. Reference photographs and product marks belong to ECD Lacrosse and their respective owners.

- https://ecdlax.com/products/mirage-3-0
  - `M3-White-Turn.jpg`, `M3-White-Side.jpg`, `M3-Black-Turn.jpg`: unstrung frame shape.
  - `M3-ELITE-White-Face.jpg`, `M3-ELITE-White-Side.jpg`: pocket, channel, shooting strings, sidewall ties.
  - Images: `https://cdn.shopify.com/s/files/1/0074/9292/7601/files/` followed by the image filename.
- https://www.lacrosseunlimited.com/products/mirage-30-white-unstrung-2017379c
  - `2017795-2.png` through `2017795-7.png`: blue Mirage 3.0 views and close-ups. Used to inspect the same head's molding, not to change its color.
  - Images: `https://cdn.shopify.com/s/files/1/0700/5939/3060/files/` followed by the image filename.
- https://www.lacrosseunlimited.com/products/mirage-30-strung-whitewhite-2017382c
  - `2017382.png`, `2017382-2.png`: strung front and side with the background removed.
- https://ecdlax.com/products/carbon-4-0-attack-midfield
  - `C4-Black-1.jpg`, `C4-Black-2.jpg`, `C4-Black-3.jpg`: shaft profile, end cap, and markings.
- https://ecdlax.com/products/soft-practice-ball
  - `Practice-Ball-Single.jpg`: optic-yellow soft practice ball, not a regulation game ball.
- https://ecdlax.com/products/hero-4-0-semi-soft
  - `Hero4-SS-White-Primary.jpg`: knit construction of the unstrung mesh.
- https://laxdrip.com/mens-lacrosse/mens-heads/ecd-mirage-3-0-lacrosse-head-review/
  - Scoop, side-profile, strung, and 360° reference crops. These repeat the manufacturer views; they are not independent measurements.

The current frame traces the alpha silhouettes and openings of `mirage-front.png` and `mirage-side.png` (Lacrosse Unlimited's `2017795.png` and `2017795-3.png`). Smooth fitted surfaces replace raw row-by-row scoop depth. The blue variant supplies geometry only; the study remains white.

`mirage-front-turn-detail.png` shows the two shallow scoop recesses. `mirage-throat-detail.png` retains the 2000-pixel source for the four rounded bottom slots. The accepted ball stop is unchanged.

The receiver now has one continuous rim and a rear wall. Its single rear screw pilot hole is provisional; available photographs do not establish its exact location or the screw-hole count. See `assets/lacrosse/HEAD-REFERENCE.md` for terminology and reference limits.

The 762 mm shaft and 64 mm ball are modeling assumptions, not measured ECD specifications. Product photos do not establish exact geometry for hidden surfaces.

## Rebuild

From `packages/lacrosse-models`, with Blender 4.5 on PATH:

```sh
blender --background --python scripts/build-lacrosse.py
blender --background --python scripts/build-patent-head.py
bun run build
bun run typecheck
bun run lint
```

The Mirage build script checks the clear head opening, scoop solidity and rear-surface smoothness, scoop recesses, six top slots, four bottom slots, rear throat wall, screw hole, and single receiver rim. It also checks the unchanged ball-stop geometry hash, uniform mesh cells, and export sizes. Results are written to `head-study-checks.json`. Reference-derived print textures are stored beside the source photos.

The patent builder writes `patent-d707770-checks.json`. It checks the aperture, stringing openings, shaft entry, closed surface, comparison width, and unchanged Mirage assets. The builders share mesh operations in `scripts/blender_geometry.py`, but have separate source data and output files.
