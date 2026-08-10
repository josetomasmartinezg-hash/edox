/**
 * Re-extract 3D-ready geometry from the architectural PDF.
 *
 * Usage:
 *   pip install pymupdf pillow numpy
 *   node scripts/extract-plan.mjs [path/to/plan.pdf]
 *
 * Writes:
 *   public/plan_geometry.json
 *   public/plan_floor.png
 *   public/plan_texture_meta.json
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdf =
  process.argv[2] ||
  path.join(
    process.env.HOME || "",
    ".cursor/projects/workspace/uploads/cesar_2-Modelo_f1f9.pdf",
  );

const py = `
import json, math, os, sys
import pymupdf
from collections import Counter

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

doc = pymupdf.open(pdf_path)
page = doc[0]
drawings = page.get_drawings()

# Scale from labeled 1.5 m module along the long facade (~A–K ≈ 15 m / 449.2 pdf units)
scale = 15.0 / 449.2

walls_raw = []
for d in drawings:
    color = d.get("color")
    width = d.get("width") or 0
    if not color or color[0] >= 0.15 or width < 0.7:
        continue
    for it in d.get("items", []):
        if it[0] != "l":
            continue
        p1, p2 = it[1], it[2]
        x1, y1, x2, y2 = p1.x, p1.y, p2.x, p2.y
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 4:
            continue
        walls_raw.append([x1, y1, x2, y2, width, L])

minx = min(min(a, c) for a, b, c, d, w, L in walls_raw)
maxx = max(max(a, c) for a, b, c, d, w, L in walls_raw)
miny = min(min(b, d) for a, b, c, d, w, L in walls_raw)
maxy = max(max(b, d) for a, b, c, d, w, L in walls_raw)
cx, cy = (minx + maxx) / 2, (miny + maxy) / 2

def to_m(x, y):
    return ((x - cx) * scale, -(y - cy) * scale)

def seg_key(s, ang_bin=5, dist_bin=3):
    x1, y1, x2, y2, w, L = s
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    rad = math.radians(ang)
    nx, ny = -math.sin(rad), math.cos(rad)
    offset = mx * nx + my * ny
    return (round(ang / ang_bin) * ang_bin, round(offset / dist_bin) * dist_bin)

groups = {}
for s in walls_raw:
    groups.setdefault(seg_key(s), []).append(s)

centerlines = []
for k, g in groups.items():
    ang = math.radians(k[0])
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    pts, offsets = [], []
    for x1, y1, x2, y2, w, L in g:
        pts += [(x1, y1), (x2, y2)]
        offsets.append(((x1 + x2) / 2) * nx + ((y1 + y2) / 2) * ny)
    off = sum(offsets) / len(offsets)
    ts = [(x - off * nx) * dx + (y - off * ny) * dy for x, y in pts]
    t0, t1 = min(ts), max(ts)
    if (t1 - t0) * scale < 0.25:
        continue
    a = (t0 * dx + off * nx, t0 * dy + off * ny)
    b = (t1 * dx + off * nx, t1 * dy + off * ny)
    th = min(max(abs(max(offsets) - min(offsets)) * scale, 0.1), 0.3) if len(g) >= 2 else 0.12
    am, bm = to_m(*a), to_m(*b)
    centerlines.append({
        "a": [round(am[0], 3), round(am[1], 3)],
        "b": [round(bm[0], 3), round(bm[1], 3)],
        "thickness": round(th, 3),
        "L": round((t1 - t0) * scale, 3),
    })

glass = []
for d in drawings:
    color = d.get("color")
    width = d.get("width") or 0
    if not color or color[0] >= 0.15 or not (0.35 <= width <= 0.5):
        continue
    for it in d.get("items", []):
        if it[0] != "l":
            continue
        p1, p2 = it[1], it[2]
        L = math.hypot(p2.x - p1.x, p2.y - p1.y)
        if L * scale < 1.5:
            continue
        a, b = to_m(p1.x, p1.y), to_m(p2.x, p2.y)
        glass.append({
            "a": [round(a[0], 3), round(a[1], 3)],
            "b": [round(b[0], 3), round(b[1], 3)],
            "L": round(L * scale, 3),
        })

bx = {
    "min_x": min(p[0] for w in centerlines for p in (w["a"], w["b"])),
    "max_x": max(p[0] for w in centerlines for p in (w["a"], w["b"])),
    "min_y": min(p[1] for w in centerlines for p in (w["a"], w["b"])),
    "max_y": max(p[1] for w in centerlines for p in (w["a"], w["b"])),
}

out = {
    "meta": {
        "scale_m_per_pdf": scale,
        "grid_m": 1.5,
        "wall_height_m": 2.7,
        "slab_thickness_m": 0.2,
        "bounds_m": bx,
        "pdf_center": [cx, cy],
        "pdf_bounds": [minx, miny, maxx, maxy],
        "source": os.path.basename(pdf_path),
    },
    "walls": centerlines,
    "columns": [],
    "glass": glass,
}

with open(os.path.join(out_dir, "plan_geometry.json"), "w") as f:
    json.dump(out, f)

pad = 50
clip = pymupdf.Rect(minx - pad, miny - pad, maxx + pad, maxy + pad)
pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip)
pix.save(os.path.join(out_dir, "plan_floor.png"))
tex = {
    "world_width": (maxx - minx + 2 * pad) * scale,
    "world_depth": (maxy - miny + 2 * pad) * scale,
}
with open(os.path.join(out_dir, "plan_texture_meta.json"), "w") as f:
    json.dump(tex, f)

print(json.dumps({"walls": len(centerlines), "glass": len(glass), "bounds_m": bx, "texture": tex}, indent=2))
`;

const result = spawnSync(
  "python3",
  ["-c", py, pdf, path.join(root, "public")],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}
console.log(result.stdout);
