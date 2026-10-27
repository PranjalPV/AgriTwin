/**
 * Procedural low-poly plant models. Every plant = a "leaves" geometry (tinted by
 * health per instance) + an optional "heads" geometry (ears, cobs, flowers, pods,
 * bunches) that appears from flowering onwards and ripens over the season.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./materials";

type G = THREE.BufferGeometry;

/** Normalise attributes so geometries can be merged. */
function prep(g: G, shade = 1, shadeTop?: number): G {
  let out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute("uv");
  if (!out.getAttribute("normal")) out.computeVertexNormals();
  const pos = out.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
  for (let i = 0; i < pos.count; i++) {
    const t = shadeTop === undefined ? 0 : (pos.getY(i) - minY) / Math.max(maxY - minY, 1e-4);
    const s = shadeTop === undefined ? shade : shade + (shadeTop - shade) * t;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s;
  }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

/** A tapered, curved leaf blade. Base at origin, grows up +Y and bends toward +Z. */
function blade(w: number, h: number, bend: number, seg = 4, taper = 0.85): G {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const y = h * t * (1 - bend * 0.35 * t);
    const z = bend * h * t * t;
    const half = (w / 2) * (1 - taper * Math.pow(t, 1.4)) * (i === seg ? 0.05 : 1) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3 + 0.25)));
    pos.push(-half, y, z, half, y, z);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Oval leaf (for broadleaf crops), lying in XZ facing up with a slight cup. */
function ovalLeaf(r: number, stretch = 1.6, seg = 7): G {
  const g = new THREE.CircleGeometry(r, seg);
  g.scale(1, stretch, 1);
  g.translate(0, r * stretch, 0);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, Math.abs(x) * 0.35); // cupped along midrib
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function place(g: G, opts: { rx?: number; ry?: number; rz?: number; x?: number; y?: number; z?: number; s?: number }) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0, "YXZ")),
    new THREE.Vector3(opts.s ?? 1, opts.s ?? 1, opts.s ?? 1),
  );
  g.applyMatrix4(m);
  return g;
}

function stalk(r0: number, r1: number, h: number, radial = 5) {
  const g = new THREE.CylinderGeometry(r1, r0, h, radial, 2, true);
  g.translate(0, h / 2, 0);
  return g;
}

function merge(parts: G[]): G {
  const m = mergeGeometries(parts, false)!;
  m.computeBoundingSphere();
  return m;
}

export type Morph = {
  leaves: G;
  heads?: G;
  height: number;
  row: number;     // spacing between rows (z)
  inRow: number;   // spacing along a row (x)
  wind: number;
  ripeGrain: boolean; // leaves turn golden at maturity
  headYoung: string;
  headRipe: string;
  headTinted: boolean; // heads follow the health tint
};

/* -------------------------------------------------------------- crops */
function wheat(): Morph {
  const r = rng(11);
  const leaves: G[] = [], heads: G[] = [];
  const stalks = 4;
  for (let i = 0; i < stalks; i++) {
    const a = (i / stalks) * Math.PI * 2 + r();
    const lean = 0.06 + r() * 0.1;
    const h = 0.78 + r() * 0.14;
    leaves.push(prep(place(blade(0.012, h, 0.05, 3, 0.3), { ry: a, rx: lean }), 0.75, 1.0));
    const tip = new THREE.Vector3(0, h, 0.05 * h).applyEuler(new THREE.Euler(lean, a, 0, "YXZ"));
    const ear = new THREE.LatheGeometry(
      [0, 0.012, 0.018, 0.019, 0.017, 0.011, 0].map((rad, k) => new THREE.Vector2(rad, k * 0.022)), 5);
    heads.push(prep(place(ear, { x: tip.x, y: tip.y - 0.01, z: tip.z, rx: lean, ry: a }), 1));
    for (let k = 0; k < 3; k++) {
      heads.push(prep(place(blade(0.004, 0.09, 0.15, 1, 0.9), {
        x: tip.x, y: tip.y + 0.12, z: tip.z, ry: a + k * 2.1, rx: lean + 0.2,
      }), 1.05));
    }
  }
  for (let i = 0; i < 6; i++) {
    leaves.push(prep(place(blade(0.032, 0.42 + r() * 0.2, 0.25 + r() * 0.2, 4), {
      ry: r() * Math.PI * 2, rx: 0.15 + r() * 0.25, y: r() * 0.15,
    }), 0.6, 1.05));
  }
  return { leaves: merge(leaves), heads: merge(heads), height: 1, row: 0.42, inRow: 0.26, wind: 0.09,
    ripeGrain: true, headYoung: "#9bc65a", headRipe: "#e2bf62", headTinted: false };
}

function rice(): Morph {
  const r = rng(21);
  const leaves: G[] = [], heads: G[] = [];
  for (let i = 0; i < 11; i++) {
    leaves.push(prep(place(blade(0.022, 0.62 + r() * 0.25, 0.3 + r() * 0.35, 4), {
      ry: r() * Math.PI * 2, rx: 0.08 + r() * 0.3,
    }), 0.6, 1.05));
  }
  for (let p = 0; p < 4; p++) {
    const a = r() * Math.PI * 2;
    const base = new THREE.Vector3(Math.sin(a) * 0.05, 0.78, Math.cos(a) * 0.05);
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const grain = new THREE.SphereGeometry(0.011, 4, 3);
      grain.scale(1, 2.3, 1);
      const off = new THREE.Vector3(0, -t * t * 0.22 + t * 0.06, t * 0.16).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      heads.push(prep(place(grain, { x: base.x + off.x, y: base.y + off.y, z: base.z + off.z, rx: 0.6 + t, ry: a }), 1));
    }
    heads.push(prep(place(blade(0.006, 0.2, 0.9, 3, 0.2), { x: base.x, y: base.y - 0.06, z: base.z, ry: a }), 0.9));
  }
  return { leaves: merge(leaves), heads: merge(heads), height: 0.95, row: 0.46, inRow: 0.32, wind: 0.08,
    ripeGrain: true, headYoung: "#a9c46a", headRipe: "#d9b35a", headTinted: false };
}

function sorghum(): Morph {
  const r = rng(31);
  const leaves: G[] = [prep(stalk(0.022, 0.015, 1.55), 0.7, 0.95)];
  for (let i = 0; i < 8; i++) {
    leaves.push(prep(place(blade(0.065, 0.62 + r() * 0.2, 0.45, 5), {
      ry: i * 2.4 + r() * 0.4, rx: 0.5 + r() * 0.2, y: 0.2 + i * 0.14,
    }), 0.6, 1.05));
  }
  const head = new THREE.IcosahedronGeometry(0.07, 1);
  head.scale(1, 1.9, 1);
  const heads = [prep(place(head, { y: 1.68 }), 1)];
  return { leaves: merge(leaves), heads: merge(heads), height: 1.8, row: 0.75, inRow: 0.4, wind: 0.07,
    ripeGrain: true, headYoung: "#b5a35a", headRipe: "#a5482a", headTinted: false };
}

function maize(): Morph {
  const r = rng(41);
  const leaves: G[] = [prep(stalk(0.03, 0.016, 2.05, 6), 0.7, 0.95)];
  for (let i = 0; i < 10; i++) {
    leaves.push(prep(place(blade(0.075, 0.78 + r() * 0.2 - i * 0.03, 0.5 + r() * 0.15, 6), {
      ry: i * Math.PI + (r() - 0.5) * 0.6, rx: 0.35 + r() * 0.15, y: 0.18 + i * 0.165,
    }), 0.55, 1.05));
  }
  const heads: G[] = [];
  for (let k = 0; k < 7; k++) {
    heads.push(prep(place(blade(0.006, 0.28, 0.35, 2, 0.5), { y: 2.02, ry: k * 0.9, rx: 0.25 + r() * 0.3 }), 1.1));
  }
  const cob = new THREE.CylinderGeometry(0.03, 0.042, 0.24, 7, 1);
  cob.translate(0, 0.12, 0);
  heads.push(prep(place(cob, { y: 0.95, rz: 0.45, x: 0.02 }), 0.9));
  return { leaves: merge(leaves), heads: merge(heads), height: 2.1, row: 0.8, inRow: 0.45, wind: 0.06,
    ripeGrain: true, headYoung: "#9fbf55", headRipe: "#d8b45c", headTinted: false };
}

function bush(seed: number, n: number, radius: number, height: number, leafR: number, flowers: "flower" | "pod" | "none") {
  const r = rng(seed);
  const leaves: G[] = [];
  const heads: G[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const t = Math.sqrt(r());
    const y = height * (0.25 + 0.75 * (1 - t * t)) * (0.7 + r() * 0.3);
    const rad = radius * t;
    const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
    leaves.push(prep(place(stalk(0.006, 0.004, Math.hypot(rad, y), 3), {
      x: 0, y: 0, z: 0, ry: a, rx: Math.atan2(rad, y),
    }), 0.6));
    leaves.push(prep(place(ovalLeaf(leafR * (0.8 + r() * 0.4)), {
      x, y, z, ry: a + (r() - 0.5), rx: -0.25 - r() * 0.5,
    }), 0.75 + r() * 0.3));
  }
  if (flowers === "flower") {
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, rad = r() * radius * 0.5;
      heads.push(prep(place(new THREE.IcosahedronGeometry(0.022, 0), { x: Math.sin(a) * rad, y: height * 1.02, z: Math.cos(a) * rad }), 1));
    }
  } else if (flowers === "pod") {
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, rad = radius * (0.2 + r() * 0.4);
      const pod = new THREE.CapsuleGeometry(0.009, 0.045, 2, 4);
      heads.push(prep(place(pod, { x: Math.sin(a) * rad, y: height * (0.35 + r() * 0.4), z: Math.cos(a) * rad, rz: 0.4, ry: a }), 1));
    }
  }
  return { leaves: merge(leaves), heads: heads.length ? merge(heads) : undefined };
}

function potato(): Morph {
  const b = bush(51, 22, 0.28, 0.5, 0.06, "flower");
  return { ...b, height: 0.55, row: 0.75, inRow: 0.4, wind: 0.04, ripeGrain: false,
    headYoung: "#f2f0ff", headRipe: "#c9b6ea", headTinted: false };
}
function soybean(): Morph {
  const b = bush(61, 26, 0.22, 0.62, 0.05, "pod");
  return { ...b, height: 0.65, row: 0.5, inRow: 0.26, wind: 0.04, ripeGrain: true,
    headYoung: "#8fbf4f", headRipe: "#b89a5a", headTinted: false };
}
function sweetpotato(): Morph {
  const b = bush(71, 30, 0.45, 0.2, 0.07, "none");
  return { ...b, height: 0.25, row: 0.9, inRow: 0.5, wind: 0.025, ripeGrain: false,
    headYoung: "#ffffff", headRipe: "#ffffff", headTinted: true };
}

function cassava(): Morph {
  const r = rng(81);
  const leaves: G[] = [prep(stalk(0.025, 0.014, 1.45, 5), 0.55, 0.75)];
  for (let p = 0; p < 6; p++) {
    const a = p * 1.05 + r() * 0.3;
    const y = 1.1 + r() * 0.35;
    const tip = new THREE.Vector3(Math.sin(a) * 0.22, y + 0.08, Math.cos(a) * 0.22);
    leaves.push(prep(place(stalk(0.004, 0.003, 0.28, 3), { y, ry: a, rx: 1.0 }), 0.7));
    for (let l = 0; l < 6; l++) {
      leaves.push(prep(place(blade(0.035, 0.22, 0.25, 3), {
        x: tip.x, y: tip.y, z: tip.z, ry: a + (l - 2.5) * 0.45, rx: 1.15,
      }), 0.75, 1.05));
    }
  }
  return { leaves: merge(leaves), height: 1.6, row: 1.0, inRow: 0.9, wind: 0.05, ripeGrain: false,
    headYoung: "#fff", headRipe: "#fff", headTinted: true };
}

function yam(): Morph {
  const r = rng(91);
  const leaves: G[] = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = t * Math.PI * 7;
    leaves.push(prep(place(ovalLeaf(0.05 + r() * 0.02, 1.4), {
      x: Math.sin(a) * 0.06, y: 0.1 + t * 1.4, z: Math.cos(a) * 0.06, ry: a, rx: -0.9,
    }), 0.75 + r() * 0.25));
  }
  const heads = [prep(stalk(0.014, 0.012, 1.6, 5), 1)];
  return { leaves: merge(leaves), heads: merge(heads), height: 1.6, row: 1.2, inRow: 1.0, wind: 0.03, ripeGrain: false,
    headYoung: "#6b4a2b", headRipe: "#6b4a2b", headTinted: false };
}

function plantain(): Morph {
  const r = rng(101);
  const leaves: G[] = [prep(stalk(0.1, 0.07, 1.55, 8), 0.65, 0.85)];
  for (let i = 0; i < 8; i++) {
    leaves.push(prep(place(blade(0.36, 1.35 + r() * 0.3, 0.55 + r() * 0.2, 8, 0.6), {
      y: 1.45, ry: i * 0.8 + r() * 0.3, rx: 0.25 + r() * 0.35,
    }), 0.6, 1.05));
  }
  const heads: G[] = [prep(place(stalk(0.012, 0.01, 0.5, 4), { y: 1.5, rx: 2.4 }), 0.7)];
  for (let h = 0; h < 5; h++) {
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      const finger = new THREE.CapsuleGeometry(0.016, 0.12, 2, 4);
      heads.push(prep(place(finger, {
        x: Math.sin(a) * 0.06, y: 1.28 - h * 0.07, z: 0.3 + Math.cos(a) * 0.06 - h * 0.03, rx: -0.5, ry: a,
      }), 1));
    }
  }
  return { leaves: merge(leaves), heads: merge(heads), height: 2.6, row: 2.4, inRow: 2.2, wind: 0.05, ripeGrain: false,
    headYoung: "#86b04a", headRipe: "#e6cf55", headTinted: false };
}

const BUILDERS: Record<string, () => Morph> = {
  wheat, rice, sorghum, maize, potato, soybean, sweetpotato, cassava, yam, plantain,
};
const cache = new Map<string, Morph>();
export function getMorph(key: string): Morph {
  if (!cache.has(key)) cache.set(key, (BUILDERS[key] || wheat)());
  return cache.get(key)!;
}

/* -------------------------------------------------- scenery geometry */
export function grassTuft(): G {
  const r = rng(7);
  const parts: G[] = [];
  for (let i = 0; i < 5; i++) {
    parts.push(prep(place(blade(0.03, 0.28 + r() * 0.2, 0.3 + r() * 0.3, 3), { ry: r() * 6.28, rx: 0.2 + r() * 0.3 }), 0.55, 1.05));
  }
  return merge(parts);
}

export function treeCanopy(kind: "round" | "tall"): G {
  const r = rng(kind === "round" ? 3 : 5);
  const parts: G[] = [];
  if (kind === "round") {
    for (let i = 0; i < 6; i++) {
      const g = new THREE.IcosahedronGeometry(1.4 + r() * 0.8, 1);
      parts.push(prep(place(g, { x: (r() - 0.5) * 2.6, y: 3.6 + r() * 1.6, z: (r() - 0.5) * 2.6 }), 0.75 + r() * 0.3));
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.IcosahedronGeometry(0.9 - i * 0.12, 1);
      g.scale(1, 1.9, 1);
      parts.push(prep(place(g, { x: (r() - 0.5) * 0.5, y: 4.2 + i * 1.5, z: (r() - 0.5) * 0.5 }), 0.75 + r() * 0.3));
    }
  }
  const m = merge(parts);
  // jitter vertices for an organic, faceted look
  const p = m.getAttribute("position");
  const jr = rng(99);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (jr() - 0.5) * 0.25, p.getY(i) + (jr() - 0.5) * 0.25, p.getZ(i) + (jr() - 0.5) * 0.25);
  m.computeVertexNormals();
  return m;
}

export function treeTrunk(kind: "round" | "tall"): G {
  const h = kind === "round" ? 3.8 : 5.5;
  const g = new THREE.CylinderGeometry(kind === "round" ? 0.18 : 0.12, kind === "round" ? 0.32 : 0.2, h, 6);
  g.translate(0, h / 2, 0);
  return prep(g, 1);
}
