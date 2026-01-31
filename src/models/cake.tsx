import { useLoader } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type CakeProps = ThreeElements["group"];

export function Cake({ children, ...groupProps }: CakeProps) {
  // FIXED: Prepended the base URL for GitHub Pages compatibility
  const modelPath = `${import.meta.env.BASE_URL}cake.glb`;
  
  const gltf = useLoader(GLTFLoader, modelPath);
  
  const cakeScene = useMemo<Group | null>(() => {
    return gltf.scene?.clone(true) ?? null;
  }, [gltf.scene]);

  if (!cakeScene) {
    return null;
  }

  return (
    <group {...groupProps}>
      <primitive object={cakeScene} />
      {children}
    </group>
  );
}
