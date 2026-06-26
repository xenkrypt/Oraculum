"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, Text, Line, Stars } from "@react-three/drei";
import * as THREE from "three";
import { TRAITS } from "@/lib/scenarios";

// ─── Types ────────────────────────────────────────────────────────────────────
type TraitData = {
  id: string;
  label: string;
  color: string;
  score: number;       // 0–100
  confidence: number;  // 0–1
};

type Props = {
  traits?: Record<string, { score: number; confidence: number }>;
  className?: string;
};

// ─── Central Brain Core ───────────────────────────────────────────────────────
function BrainCore() {
  const ref = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.15;
    ref.current.rotation.x = Math.sin(t * 0.3) * 0.08;
    const scale = 1 + Math.sin(t * 1.8) * 0.025;
    ref.current.scale.setScalar(scale);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.1 + Math.sin(t * 1.2) * 0.05);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.06 + Math.sin(t * 1.5) * 0.03;
    }
  });

  return (
    <group>
      {/* Outer glow */}
      <Sphere ref={glowRef} args={[1.05, 32, 32]}>
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.07} side={THREE.BackSide} />
      </Sphere>
      {/* Core */}
      <Sphere ref={ref} args={[0.82, 64, 64]}>
        <meshStandardMaterial
          color="#050514"
          emissive={new THREE.Color("#001e3c")}
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
          wireframe={false}
        />
      </Sphere>
      {/* Inner core glow */}
      <Sphere args={[0.5, 32, 32]}>
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.04} />
      </Sphere>
    </group>
  );
}

// ─── Trait Orbit Node ─────────────────────────────────────────────────────────
function TraitNode({
  trait,
  index,
  total,
  orbitRadius,
  orbitSpeed
}: {
  trait: TraitData;
  index: number;
  total: number;
  orbitRadius: number;
  orbitSpeed: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const phase = (index / total) * Math.PI * 2;
  const nodeSize = 0.08 + (trait.score / 100) * 0.15;
  const color = new THREE.Color(trait.color);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * orbitSpeed + phase;
    const inclination = ((index * 137.5) % 180) * (Math.PI / 180); // golden angle
    groupRef.current.position.x = Math.cos(t) * orbitRadius * Math.sin(inclination);
    groupRef.current.position.z = Math.sin(t) * orbitRadius;
    groupRef.current.position.y = Math.cos(inclination) * (orbitRadius * 0.5);
    groupRef.current.rotation.y = -t;

    if (glowRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 2 + phase) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const confidenceRingPoints = useMemo(() => {
    const points = [];
    const segments = 32;
    const r = nodeSize * 2.5;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2 * trait.confidence;
      points.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
    }
    return points;
  }, [nodeSize, trait.confidence]);

  return (
    <group ref={groupRef}>
      {/* Glow aura */}
      <Sphere ref={glowRef} args={[nodeSize * 2.2, 16, 16]}>
        <meshBasicMaterial color={trait.color} transparent opacity={0.05} />
      </Sphere>

      {/* Main node sphere */}
      <Sphere args={[nodeSize, 32, 32]}>
        <meshStandardMaterial
          color={trait.color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.4}
          roughness={0.2}
        />
      </Sphere>

      {/* Confidence ring */}
      {trait.confidence > 0.1 && (
        <Line
          points={confidenceRingPoints}
          color={trait.color}
          lineWidth={1.5}
          transparent
          opacity={0.6}
        />
      )}

      {/* Score label */}
      <Text
        position={[0, nodeSize * 2.5 + 0.04, 0]}
        fontSize={0.07}
        color={trait.color}
        anchorX="center"
        anchorY="bottom"
        renderOrder={10}
      >
        {trait.label}
      </Text>
      <Text
        position={[0, nodeSize * 2.5 - 0.05, 0]}
        fontSize={0.06}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        fillOpacity={0.5}
        renderOrder={10}
      >
        {trait.score}
      </Text>
    </group>
  );
}

// ─── Equatorial Ring ─────────────────────────────────────────────────────────
function EquatorialRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Group>(null!);
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return pts;
  }, [radius]);

  useFrame(({ clock }) => {
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.15) * 0.3;
    ref.current.rotation.y = clock.getElapsedTime() * 0.05;
  });

  return (
    <group ref={ref}>
      <Line points={points} color="#00d4ff" lineWidth={0.5} transparent opacity={0.15} />
    </group>
  );
}

// ─── Particle Stream ──────────────────────────────────────────────────────────
function ParticleStream() {
  const count = 60;
  const particlesRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 1.2 + Math.random() * 1.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  const speeds = useMemo(() => new Float32Array(count).map(() => 0.3 + Math.random() * 0.7), []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const t = clock.getElapsedTime() * speeds[i] * 0.5 + i * 0.1;
      const theta = t;
      const phi = (i / count) * Math.PI;
      const r = Math.max(0.9, 2.7 - (t % 2) * 1.2);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.4;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#00d4ff" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// ─── Scene Wrapper ────────────────────────────────────────────────────────────
function Scene({ traits }: { traits: TraitData[] }) {
  return (
    <>
      <color attach="background" args={["#050510"]} />
      <Stars radius={60} depth={50} count={1500} factor={3} fade speed={0.5} />
      <ambientLight intensity={0.15} />
      <pointLight position={[4, 4, 4]} intensity={1.5} color="#00d4ff" />
      <pointLight position={[-4, -2, -4]} intensity={0.8} color="#b347ea" />
      <pointLight position={[0, -3, 2]} intensity={0.4} color="#00ff9f" />

      <ParticleStream />
      <BrainCore />

      {/* Orbit rings */}
      <EquatorialRing radius={1.6} />
      <EquatorialRing radius={2.2} />

      {/* Trait nodes */}
      {traits.map((trait, i) => (
        <TraitNode
          key={trait.id}
          trait={trait}
          index={i}
          total={traits.length}
          orbitRadius={1.6 + (i % 3) * 0.3}
          orbitSpeed={0.15 + (i * 0.02)}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={2.5}
        maxDistance={6}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ShadowTwinBrain({ traits: traitData, className = "" }: Props) {
  // Build trait array from scores or use defaults
  const traits: TraitData[] = TRAITS.map(t => ({
    id: t.id,
    label: t.label,
    color: t.color,
    score: traitData?.[t.id]?.score ?? 50,
    confidence: traitData?.[t.id]?.confidence ?? 0
  }));

  return (
    <div className={`relative w-full ${className}`} style={{ background: "#050510" }}>
      <Canvas
        camera={{ position: [0, 1, 4], fov: 55 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene traits={traits} />
        </Suspense>
      </Canvas>

      {/* Overlay label */}
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <span className="text-xs font-sans tracking-[0.3em] text-neon-blue/40 uppercase">
          Shadow Twin — Version {Math.max(1, Math.round(traits.reduce((s, t) => s + t.confidence, 0)))}
        </span>
      </div>
    </div>
  );
}
