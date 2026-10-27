"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from "@react-three/postprocessing";
import type { Twin } from "@/lib/api";
import { Atmosphere } from "./Atmosphere";
import { FIELD, Field } from "./Field";
import { Scenery } from "./Scenery";

/** Holographic "twin sync" sweep that runs across the field when new results arrive. */
function ScanSweep({ trigger }: { trigger: string | number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const start = useRef(-10);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uA;
      void main(){
        float fade = pow(1.0 - vUv.y, 2.2);
        float lines = 0.55 + 0.45 * step(0.5, fract(vUv.y * 40.0));
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
        gl_FragColor = vec4(vec3(0.35, 1.0, 0.75) * lines, fade * edge * uA * 0.55);
      }`,
  }), []);
  useEffect(() => { start.current = performance.now(); }, [trigger]);
  useFrame(() => {
    const t = (performance.now() - start.current) / 1800;
    const on = t >= 0 && t <= 1;
    ref.current.visible = on;
    if (on) {
      ref.current.position.x = -FIELD.w / 2 + t * FIELD.w;
      mat.uniforms.uA.value = Math.sin(t * Math.PI);
    }
  });
  return (
    <mesh ref={ref} material={mat} position={[0, 1.4, 0]} rotation-y={Math.PI / 2} visible={false}>
      <planeGeometry args={[FIELD.d + 1, 2.8]} />
    </mesh>
  );
}

/** Pull the camera back on narrow/tall panels so the whole field stays in frame. */
function FitCamera() {
  const { camera, size, controls } = useThree();
  useEffect(() => {
    const k = Math.max(1, Math.min(1.9, 1.5 / (size.width / size.height)));
    camera.position.set(22 * k, 10.5 * k, 25 * k);
    camera.lookAt(0, 0.6, 0);
    (controls as unknown as { update?: () => void } | null)?.update?.();
  }, [camera, size.width, size.height, controls]);
  return null;
}

export default function TwinCanvas({
  twin, stage, quality = "high", labels = true, autoRotate = false, scanKey = 0,
}: {
  twin: Twin; stage: number; quality?: "high" | "low"; labels?: boolean; autoRotate?: boolean; scanKey?: string | number;
}) {
  return (
    <Canvas
      shadows="soft"
      dpr={quality === "high" ? [1, 2] : [1, 1.25]}
      gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.86; }}
    >
      <PerspectiveCamera makeDefault fov={38} near={0.1} far={900} position={[22, 10.5, 25]} />
      <OrbitControls
        makeDefault target={[0, 0.6, 0]} enableDamping dampingFactor={0.08}
        minDistance={3} maxDistance={110} maxPolarAngle={Math.PI / 2.08}
        autoRotate={autoRotate} autoRotateSpeed={0.35}
      />
      <FitCamera />
      <Suspense fallback={null}>
        <Atmosphere twin={twin} quality={quality} />
        <Field twin={twin} stage={stage} quality={quality} />
        <Scenery twin={twin} quality={quality} labels={labels} />
        <ScanSweep trigger={scanKey} />
      </Suspense>
      {quality === "high" ? (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO halfRes aoRadius={1.6} intensity={2.2} distanceFalloff={0.6} quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={1.1} intensity={0.55} />
          <SMAA />
          <Vignette offset={0.28} darkness={0.55} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          <Vignette offset={0.3} darkness={0.5} />
        </EffectComposer>
      )}
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
