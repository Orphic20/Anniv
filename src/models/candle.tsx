import { useFrame, useLoader } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, PointLight } from "three";
import { DoubleSide, MathUtils, ShaderMaterial } from "three";
import type { IUniform } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type CandleProps = ThreeElements["group"] & {
  isLit?: boolean;
};

type FlameUniforms = {
  time: IUniform<number>;
  strength: IUniform<number>;
};

const vertexShader = `
  uniform float time;
  varying vec2 vUv;
  varying float hValue;

  float random (in vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float noise (in vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    pos *= vec3(0.8, 2.0, 0.725);
    hValue = position.y;
    float posXZlen = length(position.xz);

    pos.y *= 1.0 + (cos((posXZlen + 0.25) * 3.1415926) * 0.4 + noise(vec2(0.0, time)) * 0.3 + noise(vec2(position.x + time, position.z + time)) * 0.8) * position.y;
    pos.x += noise(vec2(time * 2.0, (position.y - time) * 4.0)) * hValue * 0.15;
    pos.z += noise(vec2((position.y - time) * 4.0, time * 2.0)) * hValue * 0.15;
    pos.x += sin(time * 1.5 + position.y * 2.0) *
