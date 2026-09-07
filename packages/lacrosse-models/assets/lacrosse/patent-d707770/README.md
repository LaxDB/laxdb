# Warrior head — US D707770 S

Source: the user's `USD707770.pdf`, copied here without changes.

- Title: **Lacrosse Head**
- Assignee: Warrior Sports, Inc.
- Inventors: Thomas H. Burns and Adam D. Paquette
- Issued: June 24, 2014
- Selected version: **Figures 1–6**, the first embodiment
- Patent page: https://patents.google.com/patent/USD707770S1/en

Figures 7–12 show an alternative embodiment. This model does not combine the two versions or assign an unverified retail product name.

## Drawing map

| PDF page | Figure | Use |
| --- | --- | --- |
| 3 | 1 | Overall shape and visible sidewall construction |
| 4 | 2 | Sidewall outline, five windows, and 18 stringing holes per side |
| 5 | 3 | Front outline, main aperture, six oval top slots, and front throat details |
| 6 | 4 | Rear throat web and bottom stringing arrangement |
| 7 | 5–6 | Scoop depth, throat bridge, four bottom slots, and octagonal shaft entry |

**Orientation matters:** Figure 2 places the socket at the top of its sheet and the scoop at the bottom. Figures 3–4 place the scoop at the top. The generator reverses the side drawing's height direction accordingly.

The PDF contains 300-dpi, one-bit scans. The saved drawing PNGs thicken their faint lines for inspection. They do not add detail absent from the original scan.

## Reconstruction limits

`trace.json` stores manually traced control points in the saved drawing coordinates. Smooth curves connect these points. The front and side overlays show the trace against the drawings.

The patent describes the stippled regions as the claimed ornamental design. Phantom lines show context or claim boundaries. Neither dashed gaps nor stipple dots are physical holes in this model. The study reconstructs the visible frame, including contextual features; it is not a visualization limited to the legal claim.

The drawings give no manufacturing dimensions. The model uses a **166 mm maximum width for comparison with the Mirage**. Material thickness, fillet radii, and unseen transitions remain estimates. This is not manufacturer CAD or a production-ready part.

No mesh, brand badge, ECD ball-stop insert, or unshown screw detail was added. The Mirage assets remain separate and unchanged.

## Rebuild

From `packages/lacrosse-models` with Blender 4.5:

```sh
blender --background --python scripts/build-patent-head.py
```

Outputs:

- `public/models/patent-d707770.blend`
- `public/models/patent-d707770.glb`
- `public/models/patent-d707770-checks.json`

Checks cover the main aperture, top and side openings, bottom slots, shaft entry, closed surface edges, comparison width, and unchanged Mirage files. Shared mesh operations live in `scripts/blender_geometry.py`; this builder does not run the Mirage generator.
