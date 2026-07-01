// games/chess/ui/Chess3D.js
import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";

function Model() {
  const { scene } = useGLTF("/assets/chess_set_lp.glb");
  return <primitive object={scene} scale={1.5} />;
}

export default function Chess3D() {
  return (
    <div className="w-full h-[500px] bg-stone-900 rounded-2xl overflow-hidden shadow-2xl">
      <Canvas camera={{ position: [0, 5, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <Suspense fallback={null}>
          <Model />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
                                                                        }

