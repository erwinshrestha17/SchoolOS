'use client';

import { Float, OrbitControls, Sphere, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

type ModuleNode = {
  color: string;
  position: [number, number, number];
  size: number;
};

function CampusModel() {
  const groupRef = useRef<THREE.Group>(null);

  const buildings = useMemo(
    () => [
      { position: [-0.72, -0.42, 0], scale: [0.3, 0.8, 0.32], color: '#155EEF' },
      { position: [-0.34, -0.26, 0.08], scale: [0.28, 1.12, 0.3], color: '#73A7FF' },
      { position: [0.04, -0.1, 0], scale: [0.36, 1.45, 0.36], color: '#155EEF' },
      { position: [0.48, -0.34, -0.06], scale: [0.28, 0.96, 0.3], color: '#7C3AED' },
      { position: [0.82, -0.5, 0.02], scale: [0.26, 0.64, 0.28], color: '#16A34A' },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.035;
  });

  return (
    <group ref={groupRef} position={[0, -0.24, 0]}>
      <mesh position={[0.02, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.42, 96]} />
        <meshBasicMaterial color="#EAF1FF" transparent opacity={0.16} />
      </mesh>

      <mesh position={[0.02, -0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.42, 96]} />
        <meshBasicMaterial color="#A9C9FF" transparent opacity={0.24} />
      </mesh>

      {buildings.map((building) => (
        <mesh key={`${building.position.join('-')}-${building.color}`} position={building.position} scale={building.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={building.color}
            roughness={0.32}
            metalness={0.18}
            transparent
            opacity={0.72}
            emissive={building.color}
            emissiveIntensity={0.18}
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

    groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, 0.42, 0]}>
      <Float speed={1.6} rotationIntensity={0.28} floatIntensity={0.55}>
        <Sphere args={[0.58, 64, 64]}>
          <meshStandardMaterial
            color="#155EEF"
            roughness={0.2}
            metalness={0.25}
            emissive="#0B3A88"
            emissiveIntensity={0.28}
          />
        </Sphere>

        <mesh>
          <icosahedronGeometry args={[0.92, 2]} />
          <meshBasicMaterial color="#A9C9FF" wireframe transparent opacity={0.28} />
        </mesh>
      </Float>
    </group>
  );
}

function ModuleNodes() {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = useMemo<ModuleNode[]>(
    () => [
      { color: '#73A7FF', position: [-1.6, 0.72, 0.1], size: 0.09 },
      { color: '#7C3AED', position: [1.48, 0.62, -0.05], size: 0.09 },
      { color: '#16A34A', position: [-1.28, -0.72, 0.08], size: 0.08 },
      { color: '#D97706', position: [1.3, -0.68, 0.12], size: 0.08 },
      { color: '#0284C7', position: [0, 1.34, -0.08], size: 0.075 },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.24) * 0.16;
    groupRef.current.children.forEach((child, index) => {
      child.position.y = nodes[index].position[1] + Math.sin(state.clock.elapsedTime * 1.1 + index) * 0.035;
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => (
        <mesh key={`${node.color}-${node.position.join('-')}`} position={node.position}>
          <sphereGeometry args={[node.size, 28, 28]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function DataRings() {
  const ringRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ringRef.current) return;

    ringRef.current.rotation.z = state.clock.elapsedTime * 0.08;
    ringRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.32) * 0.12;
  });

  return (
    <group ref={ringRef} position={[0, 0.08, 0]}>
      {[1.18, 1.58, 1.98].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2.3, index * 0.42, 0]}>
          <torusGeometry args={[radius, 0.005, 12, 160]} />
          <meshBasicMaterial color="#A9C9FF" transparent opacity={index === 1 ? 0.22 : 0.13} />
        </mesh>
      ))}
    </group>
  );
}

export function SchoolOSLoginScene() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0.16, 4.8], fov: 42 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.05} />
        <directionalLight position={[3.5, 4, 3]} intensity={1.25} />
        <pointLight position={[-3, 2.5, 3]} intensity={1.1} color="#73A7FF" />
        <pointLight position={[3, -2, 2]} intensity={0.85} color="#7C3AED" />

        <Stars radius={34} depth={14} count={420} factor={2.4} saturation={0} fade speed={0.2} />

        <DataRings />
        <SchoolCore />
        <CampusModel />
        <ModuleNodes />

        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} autoRotate autoRotateSpeed={0.22} />
      </Canvas>
    </div>
  );
}
