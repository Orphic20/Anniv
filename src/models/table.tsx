import { useLoader } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type TableProps = ThreeElements["group"];

export function Table({ children, ...groupProps }: TableProps) {
  // FIXED: Added import.meta.env.BASE_URL so it works on GitHub Pages
  // We remove the leading slash from 'table.glb' because BASE_URL usually provides it
  const modelPath = `${import.meta.env.BASE_URL}table.glb`;
  
  const gltf = useLoader(GLTFLoader, modelPath);
  
  const tableScene = useMemo<Group | null>((() => {
    return gltf.scene?.clone(true) ?? null;
  }), [gltf.scene]);

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
