import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, MeshTransmissionMaterial } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function Floaters() {
  const group = useRef(null)
  const acc = useRef(0)

  const items = useMemo(() => {
    const rng = (min, max) => min + Math.random() * (max - min)
    const geometries = [
      new THREE.IcosahedronGeometry(1.1, 0),
      new THREE.TorusKnotGeometry(0.75, 0.2, 64, 10),
      new THREE.OctahedronGeometry(1.0, 0),
    ]

    return Array.from({ length: 3 }).map((_, i) => ({
      key: i,
      geometry: geometries[i % geometries.length],
      position: new THREE.Vector3(rng(-6, 6), rng(-2.5, 3.2), rng(-6, -1.5)),
      rotation: new THREE.Euler(rng(0, Math.PI), rng(0, Math.PI), rng(0, Math.PI)),
      speed: rng(0.04, 0.11),
      drift: rng(0.1, 0.35),
      scale: rng(0.65, 1.25),
    }))
  }, [])

  useFrame((state, delta) => {
    acc.current += delta
    if (acc.current < 1 / 30) return
    acc.current = 0

    const t = state.clock.getElapsedTime()
    if (!group.current) return

    group.current.rotation.y = t * 0.06
    group.current.rotation.x = Math.sin(t * 0.25) * 0.03

    group.current.children.forEach((child, i) => {
      const it = items[i]
      child.rotation.x = it.rotation.x + t * it.speed
      child.rotation.y = it.rotation.y + t * it.speed * 0.9
      child.position.y = it.position.y + Math.sin(t * it.drift + i) * 0.25
    })
  })

  return (
    <group ref={group}>
      {items.map((it) => (
        <mesh key={it.key} geometry={it.geometry} position={it.position} rotation={it.rotation} scale={it.scale}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.65}
            roughness={0.38}
            ior={1.15}
            chromaticAberration={0.004}
            anisotropy={0.15}
            distortion={0.02}
            distortionScale={0.05}
            temporalDistortion={0.02}
            clearcoat={1}
            clearcoatRoughness={0.16}
            color="#d9e2ff"
          />
        </mesh>
      ))}
    </group>
  )
}

export function Background3D() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        dpr={1}
        camera={{ position: [0, 0, 6.8], fov: 52 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={["#05070c"]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 5, 3]} intensity={0.85} color="#e8f0ff" />
        <directionalLight position={[-6, -2, -3]} intensity={0.35} color="#d7d4ff" />
        <Floaters />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950/80" />
    </div>
  )
}
