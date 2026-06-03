"""STEP -> GLB converter using build123d (via OCP) + trimesh.

Usage: python step_to_glb.py <input.step> <output.glb>
"""
import sys
from pathlib import Path

import trimesh
from build123d import import_step


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

    # Use build123d to import STEP, then export to STL bytes,
    # then trimesh to convert STL -> GLB (trimesh's STEP loader is unreliable;
    # build123d's import + STL bridge is the most robust path).
    compound = import_step(str(src))
    stl_path = dst.with_suffix(".tmp.stl")
    try:
        from build123d import export_stl
        export_stl(compound, str(stl_path))
        mesh = trimesh.load(str(stl_path), force="mesh")
        mesh.export(str(dst), file_type="glb")
    finally:
        if stl_path.exists():
            stl_path.unlink()

    size_kb = dst.stat().st_size / 1024
    print(f"Wrote {dst} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
