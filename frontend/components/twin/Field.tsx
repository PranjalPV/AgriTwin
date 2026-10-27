"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import type { Twin } from "@/lib/api";
import { getMorph, type Morph } from "./geometries";
import { rng, soilMaterial, windDepthMaterial, windMaterial } from "./materials";

export const FIELD = { w: 30, d: 20 };
const BUND_X = [-15, -7.5, 0, 7.5, 15];
const BUND_Z = [-10, 0, 10];

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function ridgeAmp(m: Morph) { return Math.min(0.13, 0.17 * m.row); }

export function soilHeight(x: number, z: number, m: Morph, paddy: boolean) {
  const edge = sstep(0, 0.6, Math.min(FIELD.w / 2 - Math.abs(x), FIELD.d / 2 - Math.abs(z)));
  if (paddy) {
    let b = 0;
    for (const bx of BUND_X) b = Math.max(b, sstep(0.45, 0.12, Math.abs(x - bx)));
    for (const bz of BUND_Z) b = Math.max(b, sstep(0.45, 0.12, Math.abs(z - bz)));
    return 0.22 * b;
  }
  const z0 = -FIELD.d / 2 + m.row / 2;
  const ph = ((z - z0) / m.row) * Math.PI * 2;
  return ridgeAmp(m) * Math.pow(0.5 + 0.5 * Math.cos(ph), 1.6) * edge;
}

const C = (h: string) => new THREE.Color(h);
const PAL = {
  sprout: C("#86b84a"), green: C("#467a2a"), deep: C("#2f5c1f"), yellow: C("#b9a540"),
  brown: C("#7b5a30"), rust: C("#8f4d22"), gold: C("#d9b75e"), dieback: C("#9d8a45"),
};

type Layout = {
  n: number;
  pos: Float32Array; rot: Float32Array; r1: Float32Array; r2: Float32Array; r3: Float32Array; tiltDir: Float32Array;
  patch: Float32Array;
};

function buildLayout(m: Morph, paddy: boolean, key: string): Layout {
  const r = rng(key.length * 97 + 13);
  const pts: number[] = [];
  const margin = 0.35;
  for (let z = -FIELD.d / 2 + m.row / 2; z < FIELD.d / 2 - margin / 2; z += m.row) {
    for (let x = -FIELD.w / 2 + margin; x < FIELD.w / 2 - margin; x += m.inRow) {
      const jx = x + (r() - 0.5) * m.inRow * 0.35;
      const jz = z + (r() - 0.5) * m.row * (paddy ? 0.3 : 0.12);
      if (paddy) {
        if (BUND_X.some((b) => Math.abs(jx - b) < 0.45) || BUND_Z.some((b) => Math.abs(jz - b) < 0.45)) continue;
      }
      pts.push(jx, jz);
    }
  }
  const n = pts.length / 2;
  const pos = new Float32Array(n * 3), rot = new Float32Array(n), r1 = new Float32Array(n), r2 = new Float32Array(n),
    r3 = new Float32Array(n), tiltDir = new Float32Array(n), patch = new Float32Array(n);
  const centers = Array.from({ length: 5 }, () => [(r() - 0.5) * FIELD.w * 0.8, (r() - 0.5) * FIELD.d * 0.8, 0.6 + r() * 0.8]);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], z = pts[i * 2 + 1];
    pos[i * 3] = x; pos[i * 3 + 1] = soilHeight(x, z, m, paddy); pos[i * 3 + 2] = z;
    rot[i] = r() * Math.PI * 2; r1[i] = r(); r2[i] = r(); r3[i] = r(); tiltDir[i] = r() * Math.PI * 2;
    let p = 0;
    for (const [cx, cz, w] of centers) {
      const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (w * 9);
      p = Math.max(p, Math.exp(-d2) * w);
    }
    patch[i] = Math.min(1, p + (r() < 0.04 ? 0.6 : 0));
  }
  return { n, pos, rot, r1, r2, r3, tiltDir, patch };
}

export function growth(stage: number) { return 0.07 + 0.93 * sstep(0.0, 0.62, stage); }
export function stageName(s: number) {
  return s < 0.12 ? "Sowing & germination" : s < 0.42 ? "Vegetative growth" : s < 0.68 ? "Flowering / heading" : s < 0.9 ? "Grain fill / maturity" : "Harvest ready";
}

export function Field({ twin, stage, quality }: { twin: Twin; stage: number; quality: "high" | "low" }) {
  const m = getMorph(twin.crop_key);
  const paddy = twin.paddy;
  const layout = useMemo(() => buildLayout(m, paddy, twin.crop_key), [m, paddy, twin.crop_key]);

  const leafRef = useRef<THREE.InstancedMesh>(null!);
  const headRef = useRef<THREE.InstancedMesh>(null);

  const mats = useMemo(() => ({
    leaf: windMaterial({ roughness: 0.78, metalness: 0 }, m.wind, m.height),
    leafDepth: windDepthMaterial(m.wind, m.height),
    head: windMaterial({ roughness: 0.6, metalness: 0 }, m.wind, m.height),
    headDepth: windDepthMaterial(m.wind, m.height),
  }), [m]);

  // soil mesh
  const soil = useMemo(() => {
    const g = new THREE.PlaneGeometry(FIELD.w + 0.6, FIELD.d + 0.6, 120, Math.round((FIELD.d / Math.max(m.row, 0.4)) * 10));
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setY(i, soilHeight(p.getX(i), p.getZ(i), m, paddy));
    g.computeVertexNormals();
    return { geo: g, ...soilMaterial() };
  }, [m, paddy]);

  useLayoutEffect(() => {
    soil.uniforms.uMoist.value = paddy ? Math.max(0.85, twin.moisture) : twin.moisture;
    soil.uniforms.uCrack.value = paddy ? 0 : sstep(0.42, 0.12, twin.moisture);
    soil.uniforms.uRidge.value = ridgeAmp(m);
  }, [soil, twin.moisture, paddy, m]);

  // per-instance transforms + colours
  useLayoutEffect(() => {
    const leaf = leafRef.current, head = headRef.current;
    if (!leaf) return;
    const g = growth(stage);
    const headShow = sstep(0.4, 0.62, stage);
    const ripen = sstep(0.62, 0.95, stage);
    const stress = sstep(0.82, 0.25, twin.health);
    const dis = twin.disease;
    const dry = twin.water === "dry" ? 1 : 0;
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const col = new THREE.Color(), hcol = new THREE.Color();
    const young = C(m.headYoung), ripe = C(m.headRipe);
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < layout.n; i++) {
      const dp = sstep(0.15, 0.75, layout.patch[i] * dis);           // local disease severity
      const dead = layout.r2[i] < Math.pow(1 - twin.health, 2.2) * 0.45; // gaps in poor stands
      const vig = 0.55 + 0.45 * twin.vigor;
      let sy = g * vig * (0.84 + 0.32 * layout.r1[i]) * (1 - 0.3 * dp);
      let sxz = (0.35 + 0.65 * g) * (0.9 + 0.2 * layout.r3[i]);
      if (dead) { sy *= 0.25; sxz *= 0.5; }
      const tilt = 0.06 * layout.r1[i] + dry * 0.32 * g + dp * 0.45 + (dead ? 0.6 : 0);
      axis.set(Math.cos(layout.tiltDir[i]), 0, Math.sin(layout.tiltDir[i]));
      q.setFromAxisAngle(up, layout.rot[i]);
      qt.setFromAxisAngle(axis, tilt);
      q.premultiply(qt);
      p.set(layout.pos[i * 3], layout.pos[i * 3 + 1], layout.pos[i * 3 + 2]);
      s.set(sxz, sy, sxz);
      mat.compose(p, q, s);
      leaf.setMatrixAt(i, mat);

      // leaf colour: age -> health -> disease -> senescence
      col.copy(PAL.sprout).lerp(PAL.green, sstep(0.05, 0.4, stage)).lerp(PAL.deep, 0.35 * twin.vigor * sstep(0.3, 0.6, stage));
      col.lerp(PAL.yellow, Math.min(1, stress * 0.85 + dry * 0.15));
      col.lerp(PAL.brown, sstep(0.55, 1, stress) * 0.6);
      col.lerp(PAL.rust, dp * 0.85);
      if (m.ripeGrain) col.lerp(PAL.gold, ripen * 0.85);
      else col.lerp(PAL.dieback, ripen * 0.4);
      if (dead) col.lerp(PAL.brown, 0.85);
      col.offsetHSL((layout.r3[i] - 0.5) * 0.03, 0, (layout.r1[i] - 0.5) * 0.09);
      leaf.setColorAt(i, col);

      if (head) {
        const hs = dead ? 0 : headShow * (1 - 0.5 * dp);
        if (hs < 0.01) {
          mat.makeScale(0, 0, 0);
        } else {
          s.set(sxz * hs, sy * (0.6 + 0.4 * hs), sxz * hs);
          mat.compose(p, q, s);
        }
        head.setMatrixAt(i, mat);
        if (m.headTinted) hcol.copy(col);
        else hcol.copy(young).lerp(ripe, ripen).lerp(PAL.brown, dp * 0.6 + stress * 0.25);
        hcol.offsetHSL(0, 0, (layout.r1[i] - 0.5) * 0.08);
        head.setColorAt(i, hcol);
      }
    }
    leaf.instanceMatrix.needsUpdate = true;
    if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
    leaf.computeBoundingSphere();
    if (head) {
      head.instanceMatrix.needsUpdate = true;
      if (head.instanceColor) head.instanceColor.needsUpdate = true;
      head.computeBoundingSphere();
    }
  }, [layout, stage, twin.health, twin.vigor, twin.disease, twin.water, m]);

  const waterY = paddy ? 0.075 : ridgeAmp(m) * 0.55;
  const showWater = paddy || twin.water === "waterlogged";

  return (
    <group>
      <mesh geometry={soil.geo} material={soil.material} receiveShadow />
      <instancedMesh
        key={`l-${twin.crop_key}-${layout.n}`}
        ref={leafRef}
        args={[m.leaves, mats.leaf, layout.n]}
        customDepthMaterial={mats.leafDepth}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      {m.heads && (
        <instancedMesh
          key={`h-${twin.crop_key}-${layout.n}`}
          ref={headRef}
          args={[m.heads, mats.head, layout.n]}
          customDepthMaterial={mats.headDepth}
          castShadow
          frustumCulled={false}
        />
      )}
      {showWater && (
        <mesh rotation-x={-Math.PI / 2} position={[0, waterY, 0]}>
          <planeGeometry args={[FIELD.w + 0.4, FIELD.d + 0.4]} />
          {quality === "high" ? (
            <MeshReflectorMaterial
              resolution={512}
              mirror={0.55}
              mixBlur={6}
              mixStrength={paddy ? 1.6 : 0.9}
              blur={[200, 80]}
              roughness={0.35}
              depthScale={0.4}
              minDepthThreshold={0.6}
              maxDepthThreshold={1.2}
              color={paddy ? "#4f6b5c" : "#5c4a33"}
              metalness={0.2}
              transparent
              opacity={paddy ? 0.82 : 0.75}
            />
          ) : (
            <meshStandardMaterial color={paddy ? "#56715f" : "#5c4a33"} roughness={0.15} metalness={0.3} transparent opacity={0.8} />
          )}
        </mesh>
      )}
    </group>
  );
}
