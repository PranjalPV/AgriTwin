"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Sky } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Twin } from "@/lib/api";
import { globalUniforms, rng } from "./materials";

export function lookFromTwin(t: Twin) {
  const rain = t.rain_intensity;
  const heat = Math.min(1, Math.max(0, (t.temperature - 22) / 16));
  const cold = Math.min(1, Math.max(0, (16 - t.temperature) / 14));
  const elev = 0.26 + heat * 0.25 - cold * 0.08;                  // sun height
  const sun = new THREE.Vector3(Math.cos(0.75) * 100, Math.sin(elev) * 100, Math.sin(0.75) * 100 * 0.6);
  const fog = new THREE.Color("#cfdde6").lerp(new THREE.Color("#e9dcc0"), heat * 0.7).lerp(new THREE.Color("#8d979f"), rain * 0.85);
  const sunColor = new THREE.Color("#fff1d6").lerp(new THREE.Color("#ffd49a"), heat * 0.6).lerp(new THREE.Color("#c9d3dc"), rain);
  return { rain, heat, cold, sun, fog, sunColor, sunI: 2.6 * (1 - 0.6 * rain), turbidity: 3 + heat * 6 + rain * 12, rayleigh: 1 + rain * 2.5 - heat * 0.4 };
}

function Clouds({ amount, dark }: { amount: number; dark: number }) {
  const group = useRef<THREE.Group>(null!);
  const geo = useMemo(() => {
    const r = rng(77);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.IcosahedronGeometry(2.5 + r() * 2.5, 2);
      g.translate((r() - 0.5) * 12, (r() - 0.3) * 2.2, (r() - 0.5) * 5);
      g.deleteAttribute("uv");
      parts.push(g);
    }
    const m = mergeGeometries(parts)!;
    m.scale(1, 0.55, 1);
    return m;
  }, []);
  const clouds = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 22 }, () => ({
      x: (r() - 0.5) * 320, y: 42 + r() * 25, z: (r() - 0.5) * 260 - 40, s: 0.8 + r() * 1.4, v: 0.6 + r() * 0.8,
    }));
  }, []);
  const n = Math.round(4 + amount * 18);
  useFrame((_, dt) => {
    group.current.children.forEach((c, i) => {
      c.position.x += dt * clouds[i].v * (1 + amount);
      if (c.position.x > 170) c.position.x = -170;
    });
  });
  const color = new THREE.Color("#ffffff").lerp(new THREE.Color("#6f7882"), dark);
  return (
    <group ref={group}>
      {clouds.slice(0, n).map((c, i) => (
        <mesh key={i} geometry={geo} position={[c.x, c.y, c.z]} scale={c.s}>
          <meshStandardMaterial color={color} roughness={1} transparent opacity={0.92} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

function Rain({ intensity }: { intensity: number }) {
  const N = 6000;
  const ref = useRef<THREE.LineSegments>(null!);
  const { geo, seeds } = useMemo(() => {
    const r = rng(3);
    const pos = new Float32Array(N * 6);
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seeds[i * 3] = (r() - 0.5) * 80; seeds[i * 3 + 1] = r() * 30; seeds[i * 3 + 2] = (r() - 0.5) * 60; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, seeds };
  }, []);
  useFrame(({ clock }) => {
    const count = Math.floor(N * intensity);
    geo.setDrawRange(0, count * 2);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const y = 30 - ((seeds[i * 3 + 1] + t * 22) % 30);
      const x = seeds[i * 3] + y * 0.08, z = seeds[i * 3 + 2];
      p.array[i * 6] = x; p.array[i * 6 + 1] = y; p.array[i * 6 + 2] = z;
      p.array[i * 6 + 3] = x + 0.05; p.array[i * 6 + 4] = y + 0.7; p.array[i * 6 + 5] = z;
    }
    p.needsUpdate = true;
  });
  if (intensity < 0.02) return null;
  return (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial color="#c4d2de" transparent opacity={0.45} />
    </lineSegments>
  );
}

export function Atmosphere({ twin, quality }: { twin: Twin; quality: "high" | "low" }) {
  const L = useMemo(() => lookFromTwin(twin), [twin]);
  useFrame(({ clock }) => {
    globalUniforms.uTime.value = clock.elapsedTime;
    globalUniforms.uWind.value = 0.8 + L.rain * 1.4;
  });

  return (
    <>
      <color attach="background" args={[L.fog]} />
      <fog attach="fog" args={[L.fog, 70, 260]} />
      <Sky sunPosition={L.sun} turbidity={L.turbidity} rayleigh={L.rayleigh} mieCoefficient={0.006} mieDirectionalG={0.85} distance={4000} />
      <Environment resolution={64} frames={1} environmentIntensity={0.55}>
        <Sky sunPosition={L.sun} turbidity={L.turbidity} rayleigh={L.rayleigh} />
      </Environment>
      <hemisphereLight args={["#cfe4ff", "#4a3a24", 0.35 - L.rain * 0.1]} />
      <directionalLight
        position={L.sun.clone().normalize().multiplyScalar(60)}
        intensity={L.sunI}
        color={L.sunColor}
        castShadow
        shadow-mapSize={quality === "high" ? [4096, 4096] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
      <Clouds amount={Math.min(1, 0.15 + L.rain)} dark={L.rain * 0.8} />
      <Rain intensity={L.rain} />
    </>
  );
}
