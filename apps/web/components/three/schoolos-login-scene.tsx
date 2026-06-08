'use client';

import { Float, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function SchoolBuilding() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.24) * 0.08;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.025;
  });

  const windows = useMemo(
    () => [
      [-0.92, -0.08, 0.51],
      [-0.54, -0.08, 0.51],
      [0.54, -0.08, 0.51],
      [0.92, -0.08, 0.51],
      [-0.92, 0.34, 0.51],
      [-0.54, 0.34, 0.51],
      [0.54, 0.34, 0.51],
      [0.92, 0.34, 0.51],
    ] as [number, number, number][],
    [],
  );

  return (
    <Float speed={1.15} rotationIntensity={0.06} floatIntensity={0.22}>
      <group ref={groupRef} position={[0, -0.16, 0]}>
        <mesh position={[0, -0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.35, 96]} />
          <meshBasicMaterial color="#DBEAFE" transparent opacity={0.72} />
        </mesh>

        <mesh position={[0, -0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.6, 2.32, 96]} />
          <meshBasicMaterial color="#BFDBFE" transparent opacity={0.52} />
        </mesh>

        <mesh position={[0, -0.24, 0]} scale={[2.45, 1.32, 0.9]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.42} metalness={0.03} />
        </mesh>

        <mesh position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1.1, 1.1, 0.98]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#155EEF" roughness={0.36} metalness={0.08} />
        </mesh>

        <mesh position={[0, -0.48, 0.52]} scale={[0.42, 0.84, 0.05]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0B3A88" roughness={0.4} />
        </mesh>

        {windows.map((position) => (
          <mesh key={position.join('-')} position={position} scale={[0.22, 0.18, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#EAF1FF" roughness={0.3} emissive="#A9C9FF" emissiveIntensity={0.08} />
          </mesh>
        ))}

        <mesh position={[0, 1.16, 0.02]} scale={[0.09, 0.7, 0.09]}>
          <cylinderGeometry args={[1, 1, 1, 18]} />
          <meshStandardMaterial color="#0F172A" roughness={0.4} />
        </mesh>

        <mesh position={[0.28, 1.36, 0.02]} scale={[0.42, 0.24, 0.04]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#16A34A" roughness={0.34} />
        </mesh>
      </group>
    </Float>
  );
}

function FriendlyOrbit() {
  const groupRef = useRef<THREE.Group>(null);

  const dots = useMemo(
    () => [
      { color: '#155EEF', position: [-1.72, 0.76, 0.1], size: 0.08 },
      { color: '#16A34A', position: [1.62, 0.62, 0.14], size: 0.08 },
      { color: '#D97706', position: [-1.28, -0.96, 0.12], size: 0.075 },
      { color: '#7C3AED', position: [1.2, -1.02, 0.08], size: 0.075 },
    ],
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.06;
    groupRef.current.children.forEach((child, index) => {
      child.position.y = dots[index].position[1] + Math.sin(state.clock.elapsedTime * 0.9 + index) * 0.035;
    });
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[1.92, 0.006, 12, 160]} />
        <meshBasicMaterial color="#93C5FD" transparent opacity={0.34} />
      </mesh>

      <mesh rotation={[Math.PI / 2.55, 0.5, 0]}>
        <torusGeometry args={[2.28, 0.005, 12, 160]} />
        <meshBasicMaterial color="#C4B5FD" transparent opacity={0.24} />
      </mesh>

      {dots.map((dot) => (
        <mesh key={`${dot.color}-${dot.position.join('-')}`} position={dot.position}>
          <sphereGeometry args={[dot.size, 28, 28]} />
          <meshStandardMaterial color={dot.color} emissive={dot.color} emissiveIntensity={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function SoftClouds() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.025;
  });

  return (
    <group ref={groupRef} position={[0, 0.02, -0.7]}>
      {[
        [-1.9, 1.28, 0],
        [1.92, 1.1, 0],
        [-2.08, -0.1, 0],
        [2.04, -0.38, 0],
      ].map((position, index) => (
        <mesh key={position.join('-')} position={position as [number, number, number]} scale={[0.34 + index * 0.03, 0.16, 0.04]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.56} />
        </mesh>
      ))}
    </group>
  );
}

export function SchoolOSLoginScene() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0.1, 5.15], fov: 40 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[3.5, 4.5, 4]} intensity={1.28} />
        <pointLight position={[-3, 2.5, 3]} intensity={0.75} color="#93C5FD" />
        <pointLight position={[3, -2, 2]} intensity={0.55} color="#C4B5FD" />

        <SoftClouds />
        <FriendlyOrbit />
        <SchoolBuilding />

        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} autoRotate autoRotateSpeed={0.12} />
      </Canvas>
    </div>
  );
}
