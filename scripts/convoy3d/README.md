# Convoy 3D sprite pipeline

This is a development-only Blender pipeline for the TR-7R Peregrino. Blender
is never loaded by the game: it renders transparent PNG frames, and
`export_webp.py` converts those frames to the existing 2-D asset contract.

```text
blender -b --python scripts/convoy3d/build_vehicle.py
blender -b tmp/convoy3d/tr7r_peregrino.blend --python scripts/convoy3d/render_vehicle.py
python scripts/convoy3d/export_webp.py
python scripts/convoy3d/validate_frames.py
python scripts/convoy3d/create_preview.py
```

For a single reproducible command, use `python scripts/convoy3d/run_pipeline.py`.
It detects Blender and selects the Blender renderer or the independent Pillow
fallback explicitly, then always validates frames and creates previews.

The scene uses an orthographic camera, transparent film, a fixed 896×448
render (4× the gameplay size), and three wheel objects whose origins are
defined once in `vehicles/tr7r_peregrino.py`. The Pillow builder remains a
fallback/reference renderer when Blender is unavailable; it does not read
the existing WebPs.

The Blender renderer currently implements the approved Milestone A (master,
Idle and Run). Destroyed states remain supplied by the existing procedural
fallback until the 3-D wreck storyboard is approved; the game contract and
asset catalog are unchanged during this milestone.
