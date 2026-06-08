'use client';

import { Float, Html, OrbitControls, Sphere, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function SchoolCore() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = state.clock.elapsedTime * 0.22;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.8} rotationIntensity={0.35} floatIntensity={0.8}>
        <Sphere args={[1.15, 64, 64]}>
          <meshStandardMaterial
            color="#155EEF"
            roughness={0.25}
            metalness={0.2}
            emissive="#0B3A88"
            emissiveIntensity={0.35}
          />
        </Sphere>

        <mesh>
          <icosahedronGeometry args={[1.62, 2]} />
          <meshBasicMaterial color="#A9C9FF" wireframe transparent opacity={0.2} />
        </mesh>
      </Float>
    </group>
  );
}

function OrbitingNodes() {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = useMemo(
    () => [
      { label: 'Admin', color: '#73A7FF', radius: 2.4, speed: 0.35, y: 0.8 },
      { label: 'Teacher', color: '#7C3AED', radius: 2.05, speed: -0.45, y: -0.35 },
      { label: 'Parent', color: '#16A34A', radius: 2.75, speed: 0.25, y: -0.9 },
      { label: 'Fees', color: '#D97706', radius: 2.25, speed: -0.3, y: 1.25 },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, index) => {
      const node = nodes[index];
      const angle = state.clock.elapsedTime * node.speed + index * 1.6;

      child.position.x = Math.cos(angle) * node.radius;
      child.position.z = Math.sin(angle) * node.radius;
      child.position.y = node.y;
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => (
        <group key={node.label}>
          <mesh>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.55} />
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

function ConnectionRings() {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {[1.8, 2.35, 2.9].map((radius) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, 0.006, 12, 128]} />
          <meshBasicMaterial color="#A9C9FF" transparent opacity={0.18} />
        </mesh>
      ))}
    </group>
  );
}

export function SchoolOSLoginScene() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0.2, 6], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 5, 4]} intensity={1.4} />
        <pointLight position={[-4, -2, 4]} intensity={1.8} color="#7C3AED" />

        <Stars radius={40} depth={18} count={900} factor={3} saturation={0} fade speed={0.35} />

        <SchoolCore />
        <OrbitingNodes />
        <ConnectionRings />

        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} />
      </Canvas>
    </div>
  );
}
