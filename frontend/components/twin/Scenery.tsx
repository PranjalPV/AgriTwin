"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Twin } from "@/lib/api";
import { grassTuft, treeCanopy, treeTrunk } from "./geometries";
import { FIELD } from "./Field";
import { rng, windDepthMaterial, windMaterial } from "./materials";

const HOUSE = new THREE.Vector3(-23, 0, -15);

/* ------------------------------------------------ ground & hills */
function vnoise(seed: number) {
  const r = rng(seed);
  const perm = Array.from({ length: 512 }, () => r());
  const h = (x: number, y: number) => perm[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
const n1 = vnoise(4);
export function groundHeight(x: number, z: number) {
  const dx = Math.max(0, Math.abs(x) - FIELD.w / 2 - 4), dz = Math.max(0, Math.abs(z) - FIELD.d / 2 - 4);
  const d = Math.hypot(dx, dz);
  const k = Math.min(1, d / 30);
  const hills = (n1(x * 0.02, z * 0.02) * 9 + n1(x * 0.06, z * 0.06) * 2.5) * k * k;
  return hills - 0.06 + n1(x * 0.4, z * 0.4) * 0.05;
}

function Ground({ moisture }: { moisture: number }) {
  const tint = useMemo(() => new THREE.Color("#ffffff").lerp(new THREE.Color("#d9b77a"), Math.max(0, Math.min(1, (0.45 - moisture) / 0.35)) * 0.75), [moisture]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 420, 220, 220);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute("position");
    const col = new Float32Array(p.count * 3);
    const a = new THREE.Color("#3f5f22"), b = new THREE.Color("#7a7a3a"), c = new THREE.Color("#2f4c1b"), dirt = new THREE.Color("#7d6448"), dryP = new THREE.Color("#8f8452");
    const t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const y = groundHeight(x, z);
      p.setY(i, y);
      const nn = n1(x * 0.08 + 9, z * 0.08);
      t.copy(a).lerp(b, nn * 0.8).lerp(c, n1(x * 0.3, z * 0.3) * 0.5);
      t.lerp(dryP, Math.max(0, n1(x * 0.03 + 3, z * 0.03) - 0.6) * 1.6);
      // dirt margin around field + path to the house
      const edge = Math.max(Math.abs(x) - FIELD.w / 2, Math.abs(z) - FIELD.d / 2);
      if (edge < 1.2) t.lerp(dirt, 0.85);
      const onPath = Math.abs(z - HOUSE.z) < 1.1 && x < -FIELD.w / 2 && x > HOUSE.x;
      if (onPath) t.lerp(dirt, 0.75);
      col.set([t.r, t.g, t.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} color={tint} />
    </mesh>
  );
}

/* ------------------------------------------------ wild grass */
function Grass({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => grassTuft(), []);
  const mat = useMemo(() => windMaterial({ roughness: 0.9 }, 0.12, 0.45), []);
  useLayoutEffect(() => {
    const r = rng(17);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    let i = 0;
    while (i < count) {
      const x = (r() - 0.5) * 140, z = (r() - 0.5) * 120;
      const edge = Math.max(Math.abs(x) - FIELD.w / 2, Math.abs(z) - FIELD.d / 2);
      if (edge < 1.6) continue;
      if (Math.abs(z - HOUSE.z) < 1.3 && x < -FIELD.w / 2 && x > HOUSE.x - 2) continue;
      if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 6) continue;
      if (r() < Math.min(0.8, edge / 70)) continue; // denser near field
      p.set(x, groundHeight(x, z), z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      const k = 0.45 + r() * 0.55;
      s.set(k, k * (0.7 + r() * 0.6), k);
      m.compose(p, q, s);
      ref.current.setMatrixAt(i, m);
      c.setHSL(0.2 + r() * 0.06, 0.32 + r() * 0.12, 0.2 + r() * 0.09);
      ref.current.setColorAt(i, c);
      i++;
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [count]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} receiveShadow frustumCulled={false} />;
}

/* ------------------------------------------------ trees */
function Trees({ kind, count, seed }: { kind: "round" | "tall"; count: number; seed: number }) {
  const canopy = useRef<THREE.InstancedMesh>(null!);
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const cg = useMemo(() => treeCanopy(kind), [kind]);
  const tg = useMemo(() => treeTrunk(kind), [kind]);
  const cm = useMemo(() => windMaterial({ roughness: 0.85, flatShading: true, side: THREE.FrontSide }, 0.12, 9), []);
  const cd = useMemo(() => windDepthMaterial(0.12, 9), []);
  useLayoutEffect(() => {
    const r = rng(seed);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0;
      for (;;) {
        const a = r() * Math.PI * 2, rad = 30 + r() * 75;
        x = Math.cos(a) * rad * 1.15; z = Math.sin(a) * rad;
        if (Math.hypot(x - HOUSE.x, z - HOUSE.z) > 7 && (Math.abs(x) > FIELD.w / 2 + 6 || Math.abs(z) > FIELD.d / 2 + 6)) break;
      }
      // a few trees close to the house for shade
      if (i < 3 && kind === "round") { x = HOUSE.x - 6 + i * 4; z = HOUSE.z - 7 - i; }
      p.set(x, groundHeight(x, z) - 0.1, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      const k = 0.75 + r() * 0.6;
      s.set(k, k * (0.9 + r() * 0.3), k);
      m.compose(p, q, s);
      canopy.current.setMatrixAt(i, m);
      trunk.current.setMatrixAt(i, m);
      c.setHSL(kind === "round" ? 0.27 + r() * 0.05 : 0.22 + r() * 0.05, 0.5, 0.14 + r() * 0.08);
      canopy.current.setColorAt(i, c);
      trunk.current.setColorAt(i, c.set(kind === "round" ? "#5b4330" : "#cfc4b0"));
    }
    canopy.current.instanceMatrix.needsUpdate = true;
    trunk.current.instanceMatrix.needsUpdate = true;
    canopy.current.computeBoundingSphere();
    trunk.current.computeBoundingSphere();
  }, [count, seed, kind]);
  return (
    <group>
      <instancedMesh ref={canopy} args={[cg, cm, count]} customDepthMaterial={cd} castShadow receiveShadow />
      <instancedMesh ref={trunk} args={[tg, undefined, count]} castShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------ farmhouse (UP village style) */
function Box({ args, position, color, rough = 0.9, ...rest }: { args: [number, number, number]; position: [number, number, number]; color: string; rough?: number; [k: string]: unknown }) {
  return (
    <mesh position={position} castShadow receiveShadow {...rest}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Farmhouse() {
  const y = groundHeight(HOUSE.x, HOUSE.z);
  return (
    <group position={[HOUSE.x, y, HOUSE.z]} rotation-y={0.35}>
      <Box args={[8, 0.3, 6]} position={[0, 0.15, 0]} color="#a59a88" />
      <Box args={[7, 3, 5]} position={[0, 1.8, 0]} color="#e3d2b0" />
      <Box args={[7.3, 0.25, 5.3]} position={[0, 3.4, 0]} color="#c9b48e" />
      {/* parapet */}
      <Box args={[7.3, 0.5, 0.15]} position={[0, 3.75, 2.6]} color="#d9c6a1" />
      <Box args={[7.3, 0.5, 0.15]} position={[0, 3.75, -2.6]} color="#d9c6a1" />
      <Box args={[0.15, 0.5, 5.3]} position={[3.6, 3.75, 0]} color="#d9c6a1" />
      <Box args={[0.15, 0.5, 5.3]} position={[-3.6, 3.75, 0]} color="#d9c6a1" />
      {/* stair room + black water tank */}
      <Box args={[2, 2, 2]} position={[-2.2, 4.5, -1.2]} color="#e3d2b0" />
      <mesh position={[1.8, 4.2, -1.2]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 1.3, 16]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.5} />
      </mesh>
      {/* door, windows, blue trim */}
      <Box args={[1.2, 2.1, 0.08]} position={[0.6, 1.35, 2.53]} color="#2f5d8a" />
      <Box args={[1, 0.9, 0.08]} position={[-2, 2, 2.53]} color="#27323a" rough={0.3} />
      <Box args={[1, 0.9, 0.08]} position={[2.6, 2, 2.53]} color="#27323a" rough={0.3} />
      <Box args={[7.05, 0.2, 5.05]} position={[0, 0.5, 0]} color="#2f5d8a" />
      {/* verandah tin roof on posts */}
      <mesh position={[0, 2.75, 3.6]} rotation-x={0.18} castShadow receiveShadow>
        <boxGeometry args={[7, 0.06, 2.2]} />
        <meshStandardMaterial color="#8a9298" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-3.2, 0, 3.2].map((x) => <Box key={x} args={[0.15, 2.6, 0.15]} position={[x, 1.4, 4.55]} color="#6b5139" />)}
      {/* charpai */}
      <group position={[2.2, 0.55, 4]}>
        <Box args={[1.9, 0.08, 0.9]} position={[0, 0, 0]} color="#d8c38a" />
        {[[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].map(([x, z], i) => <Box key={i} args={[0.07, 0.45, 0.07]} position={[x, -0.2, z]} color="#5b3e26" />)}
      </group>
    </group>
  );
}

function Haystack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.3, 0]}>
        <coneGeometry args={[1.8, 2.8, 14, 3]} />
        <meshStandardMaterial color="#cfa94e" roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0, 2.8, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8]} />
        <meshStandardMaterial color="#5b3e26" />
      </mesh>
    </group>
  );
}

function Tractor({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const red = "#b62a1d";
  return (
    <group position={position} rotation-y={rotation}>
      <Box args={[2.2, 0.8, 1.0]} position={[0.2, 1.1, 0]} color={red} rough={0.45} />
      <Box args={[1.1, 0.6, 0.9]} position={[1.4, 0.95, 0]} color={red} rough={0.45} />
      <Box args={[0.9, 1.1, 1.3]} position={[-0.7, 1.9, 0]} color="#d9d9d9" rough={0.3} />
      <Box args={[1.0, 0.08, 1.5]} position={[-0.7, 2.5, 0]} color={red} />
      <mesh position={[1.1, 1.8, 0.3]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.0]} />
        <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
      </mesh>
      {[[-0.75, 0.75, 0.75, 0.75], [-0.75, 0.75, -0.75, 0.75], [1.5, 0.42, 0.62, 0.42], [1.5, 0.42, -0.62, 0.42]].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation-x={Math.PI / 2}>
          <mesh castShadow>
            <cylinderGeometry args={[r, r, 0.38, 18]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.95} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[r * 0.55, r * 0.55, 0.4, 12]} />
            <meshStandardMaterial color="#d6b019" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------ tube-well + channel */
function TubeWell({ moisture }: { moisture: number }) {
  const z = -FIELD.d / 2 - 2.2;
  return (
    <group>
      <group position={[-FIELD.w / 2 - 3.5, 0, z]}>
        <Box args={[2.4, 2.1, 2.2]} position={[0, 1.05, 0]} color="#a8553a" />
        <Box args={[2.7, 0.12, 2.5]} position={[0, 2.16, 0]} color="#8f8f8f" />
        <Box args={[0.9, 1.5, 0.06]} position={[0, 0.8, 1.12]} color="#3d4b55" />
        <mesh position={[1.5, 0.5, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 10]} />
          <meshStandardMaterial color="#5c6870" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* earthen channel along the field edge */}
      <mesh position={[0, 0.0, z]} receiveShadow>
        <boxGeometry args={[FIELD.w + 6, 0.12, 0.9]} />
        <meshStandardMaterial color="#6b5238" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FIELD.w + 6, 0.6]} />
        <meshStandardMaterial color="#4f7183" roughness={0.08} metalness={0.4} transparent opacity={0.35 + 0.5 * moisture} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------ fence */
function Fence() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    const W = FIELD.w / 2 + 1.6, D = FIELD.d / 2 + 1.6;
    for (let x = -W; x <= W; x += 2.5) { out.push([x, -D], [x, D]); }
    for (let z = -D + 2.5; z < D; z += 2.5) { out.push([-W, z], [W, z]); }
    return out.filter(([x, z]) => !(x < -W + 0.1 && Math.abs(z - HOUSE.z) < 2)); // gate
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    posts.forEach(([x, z], i) => { m.makeTranslation(x, 0.55 + groundHeight(x, z), z); ref.current.setMatrixAt(i, m); });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [posts]);
  const W = FIELD.w / 2 + 1.6, D = FIELD.d / 2 + 1.6;
  const wire = (len: number, pos: [number, number, number], rotY = 0) => (
    <mesh position={pos} rotation-y={rotY}>
      <boxGeometry args={[len, 0.015, 0.015]} />
      <meshStandardMaterial color="#9ea4a8" metalness={0.8} roughness={0.3} />
    </mesh>
  );
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 1.1, 6]} />
        <meshStandardMaterial color="#7a6a55" roughness={0.95} />
      </instancedMesh>
      {[0.5, 0.9].map((h) => (
        <group key={h}>
          {wire(W * 2, [0, h, -D])}
          {wire(W * 2, [0, h, D])}
          {wire(D * 2, [W, h, 0], Math.PI / 2)}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------ IoT weather station */
function WeatherStation({ wind }: { wind: number }) {
  const cups = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame((_, dt) => {
    cups.current.rotation.y += dt * (2 + wind * 6);
    led.current.emissiveIntensity = 2 + Math.sin(performance.now() / 300) * 1.5;
  });
  return (
    <group position={[FIELD.w / 2 + 4.5, 0, -FIELD.d / 2 - 1.5]}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 4, 8]} />
        <meshStandardMaterial color="#d0d4d8" metalness={0.8} roughness={0.25} />
      </mesh>
      <group ref={cups} position={[0, 4.1, 0]}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation-y={(i * Math.PI * 2) / 3}>
            <mesh position={[0.25, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.012, 0.012, 0.5]} />
              <meshStandardMaterial color="#ccc" metalness={0.7} />
            </mesh>
            <mesh position={[0.5, 0, 0]}>
              <sphereGeometry args={[0.07, 10, 8, 0, Math.PI]} />
              <meshStandardMaterial color="#f2f2f2" side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh position={[0.35, 2.6, 0]} rotation={[-0.6, 0, 0]} castShadow>
        <boxGeometry args={[0.8, 0.04, 0.55]} />
        <meshStandardMaterial color="#1d2c4a" metalness={0.6} roughness={0.2} />
      </mesh>
      <Box args={[0.35, 0.45, 0.2]} position={[0, 1.6, 0.12]} color="#e9e9e9" rough={0.4} />
      <mesh position={[0, 1.75, 0.23]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial ref={led} color="#38ff9c" emissive="#38ff9c" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------ in-field sensor nodes */
const SENSORS: [number, number][] = [[-9, -5], [8, -4], [-4, 5.5], [10, 6], [0, 0]];

function statusColor(v: number) { return v > 0.66 ? "#38ff9c" : v > 0.4 ? "#ffc44d" : "#ff5a3c"; }

function Sensor({ x, z, twin, idx, labels }: { x: number; z: number; twin: Twin; idx: number; labels: boolean }) {
  const led = useRef<THREE.MeshStandardMaterial>(null!);
  const local = Math.max(0, Math.min(1, twin.health + (((idx * 37) % 10) - 5) * 0.012 - (idx === 2 ? twin.disease * 0.15 : 0)));
  const moist = Math.max(0, Math.min(1, twin.moisture + (((idx * 53) % 10) - 5) * 0.01));
  const c = statusColor(local);
  useFrame(() => { led.current.emissiveIntensity = 2.2 + Math.sin(performance.now() / 260 + idx) * 1.2; });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.4, 6]} />
        <meshStandardMaterial color="#c9ced3" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.12]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial ref={led} color={c} emissive={c} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {labels && (
        <Html position={[0, 1.95, 0]} center distanceFactor={14} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="twin-tag">
            <span className="dot" style={{ background: c }} />
            <b>N{idx + 1}</b>
            <span>{Math.round(moist * 100)}% soil</span>
            <span>{twin.temperature.toFixed(0)}°C</span>
            <span>{Math.round(local * 100)}% hlth</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Scenery({ twin, quality, labels }: { twin: Twin; quality: "high" | "low"; labels: boolean }) {
  return (
    <group>
      <Ground moisture={twin.moisture} />
      <Grass count={quality === "high" ? 26000 : 9000} />
      <Trees kind="round" count={quality === "high" ? 46 : 26} seed={5} />
      <Trees kind="tall" count={quality === "high" ? 34 : 16} seed={9} />
      <Farmhouse />
      <Haystack position={[HOUSE.x - 5, groundHeight(HOUSE.x - 5, HOUSE.z + 7), HOUSE.z + 7]} />
      <Haystack position={[HOUSE.x - 8, groundHeight(HOUSE.x - 8, HOUSE.z + 4.5), HOUSE.z + 4.5]} />
      <Tractor position={[-FIELD.w / 2 - 3.6, 0, 4]} rotation={Math.PI / 2 + 0.15} />
      <TubeWell moisture={twin.moisture} />
      <Fence />
      <WeatherStation wind={twin.rain_intensity} />
      {SENSORS.map(([x, z], i) => <Sensor key={i} x={x} z={z} idx={i} twin={twin} labels={labels} />)}
    </group>
  );
}
