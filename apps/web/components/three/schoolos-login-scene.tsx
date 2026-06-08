'use client';

import { Float, Html, OrbitControls, Sphere, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

type SchoolNode = {
  label: string;
  color: string;
  radius: number;
  speed: number;
  y: number;
  size: number;
};

function HolographicCampus() {
  const groupRef = useRef<THREE.Group>(null);

  const buildings = useMemo(
    () => [
      { position: [-0.9, -1.55, 0], scale: [0.36, 0.92, 0.34] },
      { position: [-0.42, -1.42, 0.1], scale: [0.32, 1.18, 0.32] },
      { position: [0, -1.28, -0.05], scale: [0.42, 1.48, 0.42] },
      { position: [0.48, -1.48, 0.12], scale: [0.34, 1.06, 0.34] },
      { position: [0.94, -1.62, -0.02], scale: [0.34, 0.78, 0.34] },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.08;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.035;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, -1.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.62, 96]} />
        <meshBasicMaterial color="#155EEF" transparent opacity={0.1} />
      </mesh>

      <mesh position={[0, -1.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.42, 1.62, 96]} />
        <meshBasicMaterial color="#A9C9FF" transparent opacity={0.24} />
      </mesh>

      {buildings.map((building, index) => (
        <mesh
          key={`${building.position.join('-')}-${index}`}
          position={building.position as [number, number, number]}
          scale={building.scale as [number, number, number]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={index === 2 ? '#73A7FF' : '#155EEF'}
            transparent
            opacity={0.45}
            roughness={0.22}
            metalness={0.35}
            emissive={index === 2 ? '#155EEF' : '#04183A'}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function SchoolCore() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = state.clock.elapsedTime * 0.22;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, 0.18, 0]}>
      <Float speed={1.8} rotationIntensity={0.35} floatIntensity={0.8}>
        <Sphere args={[1.05, 72, 72]}>
          <meshStandardMaterial
            color="#155EEF"
            roughness={0.18}
            metalness={0.28}
            emissive="#0B3A88"
            emissiveIntensity={0.46}
          />
        </Sphere>

        <mesh>
          <icosahedronGeometry args={[1.58, 2]} />
          <meshBasicMaterial color="#A9C9FF" wireframe transparent opacity={0.22} />
        </mesh>

        {[1.85, 2.18, 2.54].map((radius, index) => (
          <mesh key={radius} rotation={[Math.PI / 2.2, index * 0.36, 0]}>
            <torusGeometry args={[radius, 0.006, 12, 160]} />
            <meshBasicMaterial color="#A9C9FF" transparent opacity={index === 1 ? 0.24 : 0.14} />
          </mesh>
        ))}
      </Float>
    </group>
  );
}

function DataConstellation() {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const points = new Float32Array(520 * 3);

    for (let index = 0; index < 520; index += 1) {
      const radius = 2.7 + Math.random() * 1.7;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 3.6;

      points[index * 3] = Math.cos(angle) * radius;
      points[index * 3 + 1] = height;
      points[index * 3 + 2] = Math.sin(angle) * radius;
    }

    return points;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;

    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.045;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.035;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#A9C9FF" transparent opacity={0.42} sizeAttenuation />
    </points>
  );
}

function OrbitingNodes() {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = useMemo<SchoolNode[]>(
    () => [
      { label: 'Admin', color: '#73A7FF', radius: 2.52, speed: 0.34, y: 0.92, size: 0.13 },
      { label: 'Teachers', color: '#7C3AED', radius: 2.18, speed: -0.44, y: -0.16, size: 0.12 },
      { label: 'Parents', color: '#16A34A', radius: 2.82, speed: 0.25, y: -0.86, size: 0.12 },
      { label: 'Fees', color: '#D97706', radius: 2.36, speed: -0.31, y: 1.32, size: 0.12 },
      { label: 'Attendance', color: '#0284C7', radius: 3.08, speed: 0.2, y: 0.1, size: 0.11 },
      { label: 'Academics', color: '#DB2777', radius: 2.68, speed: -0.24, y: -1.36, size: 0.11 },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, index) => {
      const node = nodes[index];
      const angle = state.clock.elapsedTime * node.speed + index * 1.06;

      child.position.x = Math.cos(angle) * node.radius;
      child.position.z = Math.sin(angle) * node.radius;
      child.position.y = node.y + Math.sin(state.clock.elapsedTime * 0.72 + index) * 0.08;
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => (
        <group key={node.label}>
          <mesh>
            <sphereGeometry args={[node.size, 28, 28]} />
            <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.62} />
          </mesh>

          <mesh>
            <sphereGeometry args={[node.size * 1.9, 28, 28]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.12} />
          </mesh>

          <Html distanceFactor={8} center className="pointer-events-none select-none">
            <div className="rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-xl backdrop-blur-md">
              {node.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function AmbientPanels() {
  return (
    <group>
      <Html position={[-2.95, 1.82, 0.45]} transform distanceFactor={6} className="pointer-events-none select-none">
        <div className="w-40 rounded-2xl border border-white/15 bg-slate-950/55 p-3 text-white shadow-2xl backdrop-blur-xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-primary-200">Live Signal</p>
          <p className="mt-1 text-xl font-black">98.7%</p>
          <p className="text-[10px] text-slate-300">system availability</p>
        </div>
      </Html>

      <Html position={[2.92, -1.58, 0.35]} transform distanceFactor={6} className="pointer-events-none select-none">
        <div className="w-44 rounded-2xl border border-white/15 bg-slate-950/55 p-3 text-white shadow-2xl backdrop-blur-xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-200">Protected</p>
          <p className="mt-1 text-xl font-black">RBAC</p>
          <p className="text-[10px] text-slate-300">role-scoped school access</p>
        </div>
      </Html>
    </group>
  );
}

export function SchoolOSLoginScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0.08, 6.2], fov: 43 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.75]}
      >
        <ambientLight intensity={0.82} />
        <directionalLight position={[4, 5, 4]} intensity={1.35} />
        <pointLight position={[-4, -2, 4]} intensity={1.8} color="#7C3AED" />
        <pointLight position={[3.8, 2.6, 2]} intensity={1.35} color="#73A7FF" />

        <Stars radius={42} depth={18} count={1200} factor={3} saturation={0} fade speed={0.35} />

        <DataConstellation />
        <SchoolCore />
        <HolographicCampus />
        <OrbitingNodes />
        <AmbientPanels />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          autoRotate
          autoRotateSpeed={0.26}
        />
      </Canvas>
    </div>
  );
}
