"""STEP -> GLB converter using build123d (via OCP) + trimesh.

Bakes a steel-blue CAD-style material into the GLB so it has contrast
against the website's light background.

Usage: python step_to_glb.py <input.step> <output.glb>
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from build123d import import_step

# Steel-blue, slightly darker than the off-white background for clear contrast.
# RGBA, 0-255.
CAD_COLOR = np.array([100, 110, 125, 255], dtype=np.uint8)


def main():
    if len(sys.argv) != 3:
        print("Usage: python step_to_glb.py <input.step> <output.glb>", file=sys.stderr)
        sys.exit(2)
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if not src.exists():
        print(f"Source STEP not found: {src}", file=sys.stderr)
        sys.exit(1)
    dst.parent.mkdir(parents=True, exist_ok=True)

    compound = import_step(str(src))
    stl_path = dst.with_suffix(".tmp.stl")
    try:
        from build123d import export_stl
        export_stl(compound, str(stl_path))
        mesh = trimesh.load(str(stl_path), force="mesh")
        # Paint every face with the steel-blue CAD color so the GLB has
        # consistent shading regardless of the viewer's environment.
        mesh.visual.face_colors = np.tile(CAD_COLOR, (len(mesh.faces), 1))
        mesh.export(str(dst), file_type="glb")
    finally:
        if stl_path.exists():
            stl_path.unlink()

    size_kb = dst.stat().st_size / 1024
    print(f"Wrote {dst} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
