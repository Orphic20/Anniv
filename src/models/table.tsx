import { useLoader } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type TableProps = ThreeElements["group"];

export function Table({ children, ...groupProps }: TableProps) {
  // FIXED: Using BASE_URL for GitHub Pages compatibility
  const modelPath = `${import.meta.env.BASE_URL}table.glb`;
  
  const gltf = useLoader(GLTFLoader, modelPath);
  
  const tableScene = useMemo<Group | null>(() => {
    return gltf.scene?.clone(true) ?? null;
  }, [gltf.scene]);

  if (!tableScene) {
    return null;
  }

  return (
    <group {...groupProps}>
      <primitive object={tableScene} />
      {children}
    </group>
  );
}
