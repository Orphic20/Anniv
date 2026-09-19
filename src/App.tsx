import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { Group } from "three";
import { TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Candle } from "./models/candle";
import { Cake } from "./models/cake";
import { Table } from "./models/table";
import { PictureFrame } from "./models/pictureFrame";
import { Fireworks } from "./components/Fireworks";
import { BirthdayCard } from "./components/BirthdayCard";

import "./App.css";

// HELPER: This fixes the 404 errors on GitHub Pages by prepending the base path
const withBase = (path: string) => {
  const base = import.meta.env.BASE_URL;
  // Remove leading slash from path if it exists to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type AnimatedSceneProps = {
  isPlaying: boolean;
  onBackgroundFadeChange?: (opacity: number) => void;
  onEnvironmentProgressChange?: (progress: number) => void;
  candleLit: boolean;
  canBlowCandle?: boolean;
  onBlowCandle?: () => void;
  onAnimationComplete?: () => void;
  cards: ReadonlyArray<BirthdayCardConfig>;
  activeCardId: string | null;
  onToggleCard: (id: string) => void;
};

const CAKE_START_Y = 10;
const CAKE_END_Y = 0;
const CAKE_DESCENT_DURATION = 3;

const TABLE_START_Z = 30;
const TABLE_END_Z = 0;
const TABLE_SLIDE_DURATION = 0.7;
const TABLE_SLIDE_START = CAKE_DESCENT_DURATION - TABLE_SLIDE_DURATION - 0.1;

const CANDLE_START_Y = 5;
const CANDLE_END_Y = 0;
const CANDLE_DROP_DURATION = 1.2;
const CANDLE_DROP_START =
  Math.max(CAKE_DESCENT_DURATION, TABLE_SLIDE_START + TABLE_SLIDE_DURATION) +
  1.0;

const totalAnimationTime = CANDLE_DROP_START + CANDLE_DROP_DURATION;

const ORBIT_TARGET = new Vector3(0, 1, 0);
const ORBIT_INITIAL_RADIUS = 3;
const ORBIT_INITIAL_HEIGHT = 1;
const ORBIT_INITIAL_AZIMUTH = Math.PI / 2;
const ORBIT_MIN_DISTANCE = 2;
const ORBIT_MAX_DISTANCE = 8;
const ORBIT_MIN_POLAR = 0;
const ORBIT_MAX_POLAR = Math.PI / 2;

const BACKGROUND_FADE_DURATION = 1;
const BACKGROUND_FADE_START = 2;

const TYPED_LINES = [
  "> Julianne",
  "...",
  "> today is our anniversary",
  "...",
  "> so i made you this computer program with the help of the internet",
  "...",
  "( ˶˘ ³˘)♡ ( ˶˘ ³˘)♡ ( ˶˘ ³˘)♡"
];
const TYPED_CHAR_DELAY = 100;
const POST_TYPING_SCENE_DELAY = 1000;
const CURSOR_BLINK_INTERVAL = 480;

type BirthdayCardConfig = {
  id: string;
  image: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

const BIRTHDAY_CARDS: ReadonlyArray<BirthdayCardConfig> = [
  {
    id: "confetti",
    image: withBase("/card.png"), // FIXED PATH
    position: [1, 0.081, -2],
    rotation: [-Math.PI / 2, 0, Math.PI / 3],
  }
];

function AnimatedScene({
  isPlaying,
  onBackgroundFadeChange,
  onEnvironmentProgressChange,
  candleLit,
  canBlowCandle = false,
  onBlowCandle,
  onAnimationComplete,
  cards,
  activeCardId,
  onToggleCard,
}: AnimatedSceneProps) {
  const cakeGroup = useRef<Group>(null);
  const tableGroup = useRef<Group>(null);
  const candleGroup = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const hasPrimedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const completionNotifiedRef = useRef(false);
  const backgroundOpacityRef = useRef(1);
  const environmentProgressRef = useRef(0);

  useEffect(() => {
    onBackgroundFadeChange?.(backgroundOpacityRef.current);
    onEnvironmentProgressChange?.(environmentProgressRef.current);
  }, [onBackgroundFadeChange, onEnvironmentProgressChange]);

  const emitBackgroundOpacity = (value: number) => {
    const clamped = clamp(value, 0, 1);
    if (Math.abs(clamped - backgroundOpacityRef.current) > 0.005) {
      backgroundOpacityRef.current = clamped;
      onBackgroundFadeChange?.(clamped);
    }
  };

  const emitEnvironmentProgress = (value: number) => {
    const clamped = clamp(value, 0, 1);
    if (Math.abs(clamped - environmentProgressRef.current) > 0.005) {
      environmentProgressRef.current = clamped;
      onEnvironmentProgressChange?.(clamped);
    }
  };

  useFrame(({ clock }) => {
    const cake = cakeGroup.current;
    const table = tableGroup.current;
    const candle = candleGroup.current;

    if (!cake || !table || !candle) return;

    if (!hasPrimedRef.current) {
      cake.position.set(0, CAKE_START_Y, 0);
      table.position.set(0, 0, TABLE_START_Z);
      candle.position.set(0, CANDLE_START_Y, 0);
      candle.visible = false;
      hasPrimedRef.current = true;
    }

    if (!isPlaying) {
      emitBackgroundOpacity(1);
      emitEnvironmentProgress(0);
      animationStartRef.current = null;
      hasCompletedRef.current = false;
      return;
    }

    if (hasCompletedRef.current) {
      emitBackgroundOpacity(0);
      emitEnvironmentProgress(1);
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onAnimationComplete?.();
      }
      return;
    }

    if (animationStartRef.current === null) {
      animationStartRef.current = clock.elapsedTime;
    }

    const elapsed = clock.elapsedTime - animationStartRef.current;
    const clampedElapsed = clamp(elapsed, 0, totalAnimationTime);

    // Cake logic
    const cakeProgress = clamp(clampedElapsed / CAKE_DESCENT_DURATION, 0, 1);
    const cakeEase = easeOutCubic(cakeProgress);
    cake.position.y = lerp(CAKE_START_Y, CAKE_END_Y, cakeEase);
    cake.rotation.y = cakeEase * Math.PI * 2;

    // Table logic
    let tableZ = TABLE_START_Z;
    if (clampedElapsed >= TABLE_SLIDE_START) {
      const tableProgress = clamp((clampedElapsed - TABLE_SLIDE_START) / TABLE_SLIDE_DURATION, 0, 1);
      tableZ = lerp(TABLE_START_Z, TABLE_END_Z, easeOutCubic(tableProgress));
    }
    table.position.z = tableZ;

    // Candle logic
    if (clampedElapsed >= CANDLE_DROP_START) {
      candle.visible = true;
      const candleProgress = clamp((clampedElapsed - CANDLE_DROP_START) / CANDLE_DROP_DURATION, 0, 1);
      candle.position.y = lerp(CANDLE_START_Y, CANDLE_END_Y, easeOutCubic(candleProgress));
    }

    // Fade logic
    if (clampedElapsed >= BACKGROUND_FADE_START) {
      const fadeProgress = clamp((clampedElapsed - BACKGROUND_FADE_START) / BACKGROUND_FADE_DURATION, 0, 1);
      const backgroundOpacity = 1 - easeOutCubic(fadeProgress);
      emitBackgroundOpacity(backgroundOpacity);
      emitEnvironmentProgress(1 - backgroundOpacity);
    }

    if (clampedElapsed >= totalAnimationTime) {
      hasCompletedRef.current = true;
    }
  });

  return (
    <>
      <group ref={tableGroup}>
        <Table />
        {/* FIXED IMAGE PATHS FOR FRAMES */}
        <PictureFrame image={withBase("/frame2.jpg")} position={[0, 0.735, 3]} rotation={[0, 5.6, 0]} scale={0.75} />
        <PictureFrame image={withBase("/frame3.jpg")} position={[0, 0.735, -3]} rotation={[0, 4.0, 0]} scale={0.75} />
        <PictureFrame image={withBase("/frame4.jpg")} position={[-1.5, 0.735, 2.5]} rotation={[0, 5.4, 0]} scale={0.75} />
        <PictureFrame image={withBase("/frame1.jpg")} position={[-1.5, 0.735, -2.5]} rotation={[0, 4.2, 0]} scale={0.75} />
        {cards.map((card) => (
          <BirthdayCard
            key={card.id}
            id={card.id}
            image={card.image}
            tablePosition={card.position}
            tableRotation={card.rotation}
            isActive={activeCardId === card.id}
            onToggle={onToggleCard}
          />
        ))}
      </group>
      <group ref={cakeGroup}>
        <Cake />
      </group>
      <group ref={candleGroup}>
        <Candle isLit={candleLit} scale={0.25} position={[0, 1.1, 0]} />
        {canBlowCandle && (
          <mesh
            position={[0, 1.4, 0]}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onBlowCandle?.();
            }}
          >
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
    </>
  );
}

function ConfiguredOrbitControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const offset = new Vector3(
      Math.sin(ORBIT_INITIAL_AZIMUTH) * ORBIT_INITIAL_RADIUS,
      ORBIT_INITIAL_HEIGHT,
      Math.cos(ORBIT_INITIAL_AZIMUTH) * ORBIT_INITIAL_RADIUS
    );
    camera.position.copy(ORBIT_TARGET.clone().add(offset));
    camera.lookAt(ORBIT_TARGET);
    if (controlsRef.current) {
      controlsRef.current.target.copy(ORBIT_TARGET);
      controlsRef.current.update();
    }
  }, [camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      enablePan={false}
      dampingFactor={0.05}
      minDistance={ORBIT_MIN_DISTANCE}
      maxDistance={ORBIT_MAX_DISTANCE}
      minPolarAngle={ORBIT_MIN_POLAR}
      maxPolarAngle={ORBIT_MAX_POLAR}
      rotateSpeed={0.85}
      zoomSpeed={0.8}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
    />
  );
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [environmentProgress, setEnvironmentProgress] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [sceneStarted, setSceneStarted] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [hasAnimationCompleted, setHasAnimationCompleted] = useState(false);
  const [isCandleLit, setIsCandleLit] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(withBase("/music.mp3")); // FIXED PATH
    audio.loop = true;
    backgroundAudioRef.current = audio;
    return () => audio.pause();
  }, []);

  const playBackgroundMusic = useCallback(() => {
    backgroundAudioRef.current?.play().catch(() => {});
  }, []);

  const startExperience = useCallback(() => {
    if (hasStarted) return;
    playBackgroundMusic();
    setHasStarted(true);
  }, [hasStarted, playBackgroundMusic]);

  const blowOutCandle = useCallback(() => {
    if (!hasAnimationCompleted || !isCandleLit) return;
    setIsCandleLit(false);
    setFireworksActive(true);
  }, [hasAnimationCompleted, isCandleLit]);

  const handleToggleCard = useCallback((id: string) => {
    setActiveCardId((current) => (current === id ? null : id));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const typingComplete = currentLineIndex >= TYPED_LINES.length;
  const typedLines = useMemo(() => {
    return TYPED_LINES.map((line, index) => {
      if (typingComplete || index < currentLineIndex) return line;
      if (index === currentLineIndex) return line.slice(0, currentCharIndex);
      return "";
    });
  }, [currentCharIndex, currentLineIndex, typingComplete]);

  useEffect(() => {
    if (!hasStarted) return;
    if (typingComplete) {
      if (!sceneStarted) setTimeout(() => setSceneStarted(true), POST_TYPING_SCENE_DELAY);
      return;
    }
    const currentLine = TYPED_LINES[currentLineIndex] ?? "";
    const handle = setTimeout(() => {
      if (currentCharIndex < currentLine.length) {
        setCurrentCharIndex(prev => prev + 1);
      } else {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }
    }, TYPED_CHAR_DELAY);
    return () => clearTimeout(handle);
  }, [hasStarted, currentCharIndex, currentLineIndex, typingComplete, sceneStarted]);

  useEffect(() => {
    const handle = setInterval(() => setCursorVisible(v => !v), CURSOR_BLINK_INTERVAL);
    return () => clearInterval(handle);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      if (!hasStarted) {
        startExperience();
      } else {
        blowOutCandle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasStarted, startExperience, blowOutCandle]);

  return (
    <div className="App" onContextMenu={(event) => event.preventDefault()}>
      <div
        className={`background-overlay${hasStarted ? "" : " is-start"}`}
        style={{ opacity: backgroundOpacity }}
        {...(!hasStarted
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-label": "Start anniversary",
              onPointerDown: startExperience,
              onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.code === "Space" || event.code === "Enter") {
                  event.preventDefault();
                  startExperience();
                }
              },
            }
          : {})}
      >
        {hasStarted ? (
          <div className="typed-text">
            {typedLines.map((line, i) => (
              <span className="typed-line" key={i}>
                {line || "\u00a0"}
                {cursorVisible && i === (typingComplete ? typedLines.length - 1 : currentLineIndex) && !sceneStarted && <span className="typed-cursor">_</span>}
              </span>
            ))}
          </div>
        ) : (
          <div className="start-prompt">
            <span className="start-prompt-label">
              {isTouch ? "tap to start" : "click or tap to start"}
            </span>
          </div>
        )}
      </div>
      {hasAnimationCompleted && isCandleLit && (
        <button
          type="button"
          className="hint-overlay hint-button"
          onClick={blowOutCandle}
        >
          {isTouch ? "tap to blow out the candle" : "tap the candle or press space"}
        </button>
      )}
      <Canvas
        gl={{ alpha: true }}
        dpr={[1, 1.75]}
        style={{ touchAction: "none" }}
        onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
      >
        <Suspense fallback={null}>
          <AnimatedScene
            isPlaying={hasStarted && sceneStarted}
            candleLit={isCandleLit}
            canBlowCandle={hasAnimationCompleted && isCandleLit}
            onBlowCandle={blowOutCandle}
            onBackgroundFadeChange={setBackgroundOpacity}
            onEnvironmentProgressChange={setEnvironmentProgress}
            onAnimationComplete={() => setHasAnimationCompleted(true)}
            cards={BIRTHDAY_CARDS}
            activeCardId={activeCardId}
            onToggleCard={handleToggleCard}
          />
          
          {/* === LIGHTING UPGRADE === */}
          {/* Increased intensity so scene is much lighter */}
          <ambientLight intensity={(1 - environmentProgress) * 2.5} />
          <directionalLight intensity={2.0} position={[2, 10, 0]} />
          
          {/* Boosted environment intensity so the background light is visible */}
          <Environment
            files={[withBase("/baguio.hdr")]}
            background
            environmentIntensity={1.5 * environmentProgress}
            backgroundIntensity={0.5 * environmentProgress}
          />
          
          <Fireworks isActive={fireworksActive} origin={[0, 10, 0]} />
          <ConfiguredOrbitControls />
        </Suspense>
      </Canvas>
    </div>
  );
}
