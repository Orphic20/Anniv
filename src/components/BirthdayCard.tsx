import { useCursor, useTexture } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DoubleSide,
  Euler,
  Group,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";

type BirthdayCardProps = {
  id: string;
  image: string;
  tablePosition: [number, number, number];
  tableRotation: [number, number, number];
  isActive: boolean;
  onToggle: (id: string) => void;
  children?: ReactNode;
};

const CARD_SCALE = 0.25;
const CARD_WIDTH = 4 * CARD_SCALE;
const CARD_HEIGHT = 3 * CARD_SCALE;
const CAMERA_DISTANCE = 1.2;
const CAMERA_Y_FLOOR = 0.8;
const HOVER_LIFT = 0.04;

export function BirthdayCard({
  id,
  image,
  tablePosition,
  tableRotation,
  isActive,
  onToggle,
  children,
}: BirthdayCardProps) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);

  useCursor(isHovered || isActive, "pointer");

  const texture = useTexture(image);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  const defaultPosition = useMemo(
    () => new Vector3(...tablePosition),
    [tablePosition]
  );
  const defaultQuaternion = useMemo(() => {
    const euler = new Euler(...tableRotation);
    return new Quaternion().setFromEuler(euler);
  }, [tableRotation]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    group.position.copy(defaultPosition);
    group.quaternion.copy(defaultQuaternion);
  }, [defaultPosition, defaultQuaternion]);

  useEffect(() => {
    if (!isActive) {
      setIsHovered(false);
    }
  }, [isActive]);

  const tmpPosition = useMemo(() => new Vector3(), []);
  const tmpQuaternion = useMemo(() => new Quaternion(), []);
  const tmpDirection = useMemo(() => new Vector3(), []);
  const cameraOffset = useMemo(() => new Vector3(0, -0.05, 0), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const positionTarget = tmpPosition;
    const rotationTarget = tmpQuaternion;

    if (isActive) {
      positionTarget.copy(camera.position);
      positionTarget.add(
        tmpDirection
          .copy(camera.getWorldDirection(tmpDirection))
          .multiplyScalar(CAMERA_DISTANCE)
      );
      positionTarget.add(cameraOffset);
      if (positionTarget.y < CAMERA_Y_FLOOR) {
        positionTarget.y = CAMERA_Y_FLOOR;
      }

      rotationTarget.copy(camera.quaternion);
    } else {
      positionTarget.copy(defaultPosition);
      if (isHovered) {
        positionTarget.y += HOVER_LIFT;
      }
      rotationTarget.copy(defaultQuaternion
