import React, { useRef, Suspense } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { RobotState, OptimizedPathPoint } from '../types';

useGLTF.preload('/fields/Field3d_2025FRCFieldWeldedV2/model.glb');
useGLTF.preload('/fields/robot/model.glb');

interface RobotInSceneProps {
  robotState: RobotState;
  fieldWidth: number;
  fieldHeight: number;
}

const RobotInScene: React.FC<RobotInSceneProps> = ({ robotState, fieldWidth, fieldHeight }) => {
  const groupRef = useRef<THREE.Group>(null!);

  const RobotModel: React.FC = () => {
    const { scene } = useGLTF('/fields/robot/model.glb');
    console.log('Robot GLB scene loaded:', scene); // Debug log
    scene.scale.set(1, 1, 1); // Adjust scale (e.g., 0.01 for cm)
    scene.rotation.set(-Math.PI / 2, 0, Math.PI / 2); // Adjust if z-up
    return <primitive object={scene} />;
  };

  const FallbackRobot = () => {
    const chassisWidth = 0.7;
    const chassisHeight = 0.25;
    const chassisDepth = 0.7;
    const indicatorWidth = chassisWidth * 0.6;
    const indicatorHeight = chassisHeight * 0.8;
    const indicatorDepth = 0.3;
    const indicatorOffsetZ = chassisDepth / 2 + indicatorDepth / 2 - 0.05;
    return (
      <group>
        <mesh>
          <boxGeometry args={[chassisWidth, chassisHeight, chassisDepth]} />
          <meshStandardMaterial color="royalblue" />
        </mesh>
        <mesh position={[0, 0, indicatorOffsetZ]}>
          <boxGeometry args={[indicatorWidth, indicatorHeight, indicatorDepth]} />
          <meshStandardMaterial color="darkorange" />
        </mesh>
        <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, chassisHeight / 2 + 0.1, 0), 0.5, 0xff0000]} />
      </group>
    );
  };

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        robotState.x - fieldWidth / 2,
        0, // Adjust if robot GLB needs a y-offset
        -(robotState.y - fieldHeight / 2)
      );
      groupRef.current.rotation.y = -THREE.MathUtils.degToRad(robotState.rotation);
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<FallbackRobot />}>
        <RobotModel />
      </Suspense>
    </group>
  );
};

interface PathVisualizerProps {
  pathPoints: OptimizedPathPoint[];
  fieldWidth: number;
  fieldHeight: number;
}

const PathVisualizer: React.FC<PathVisualizerProps> = ({ pathPoints, fieldWidth, fieldHeight }) => {
  const points = React.useMemo(() => {
    if (!pathPoints || pathPoints.length === 0) return [];
    return pathPoints.map(p => new THREE.Vector3(
      p.x - fieldWidth / 2,
      0.1,
      -(p.y - fieldHeight / 2)
    ));
  }, [pathPoints, fieldWidth, fieldHeight]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color="red"
      lineWidth={3}
    />
  );
};

interface TimeIndicatorProps {
  pathPoints: OptimizedPathPoint[];
  currentTime: number;
  totalPathTime: number;
  fieldWidth: number;
  fieldHeight: number;
}

const TimeIndicator: React.FC<TimeIndicatorProps> = ({ pathPoints, currentTime, totalPathTime, fieldWidth, fieldHeight }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  const currentPosition = React.useMemo(() => {
    if (!pathPoints || pathPoints.length < 2 || totalPathTime <= 0) {
      return new THREE.Vector3(0, -1000, 0);
    }
    if (currentTime <= 0) {
      return new THREE.Vector3(
        pathPoints[0].x - fieldWidth / 2,
        0.15,
        -(pathPoints[0].y - fieldHeight / 2)
      );
    }
    if (currentTime >= totalPathTime) {
      const lastPoint = pathPoints[pathPoints.length - 1];
      return new THREE.Vector3(
        lastPoint.x - fieldWidth / 2,
        0.15,
        -(lastPoint.y - fieldHeight / 2)
      );
    }

    let p1 = pathPoints[0];
    let p2 = pathPoints[pathPoints.length - 1];

    for (let i = 0; i < pathPoints.length - 1; i++) {
      if (pathPoints[i].time <= currentTime && pathPoints[i + 1].time >= currentTime) {
        p1 = pathPoints[i];
        p2 = pathPoints[i + 1];
        break;
      }
    }

    const timeRatio = (currentTime - p1.time) / (p2.time - p1.time);
    const interpRatio = (p2.time - p1.time === 0) ? 0 : timeRatio;

    const x = p1.x + (p2.x - p1.x) * interpRatio;
    const y = p1.y + (p2.y - p1.y) * interpRatio;

    return new THREE.Vector3(
      x - fieldWidth / 2,
      0.15,
      -(y - fieldHeight / 2)
    );
  }, [pathPoints, currentTime, totalPathTime, fieldWidth, fieldHeight]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(currentPosition);
    }
  });

  if (!pathPoints || pathPoints.length < 2) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={2} />
    </mesh>
  );
};

interface FieldModelProps {
  fieldWidth: number;
  fieldHeight: number;
}

const FieldModel: React.FC<FieldModelProps> = ({ fieldWidth, fieldHeight }) => {
  const fieldGroupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF('/fields/Field3d_2025FRCFieldWeldedV2/model.glb');

  // Log to confirm GLB is loaded
  console.log('Field GLB scene loaded:', scene);

  // Setup field
  scene.scale.set(1, 1, 1); // Adjust if not in meters (e.g., 0.01 for cm)
  scene.rotation.set(0, 0, 0); // Align z-up to y-up
  scene.position.set(0, -0.01, 0); // Center bottom-left origin

  // Add bounding box for debugging
  const boundingBox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  console.log('Field GLB bounding box size:', size); // Log dimensions
  const boxHelper = new THREE.Box3Helper(boundingBox, 0xff0000); // Red outline

  return (
    <group ref={fieldGroupRef}>
      <primitive object={scene} />
      <primitive object={boxHelper} />
    </group>
  );
};

interface Floating3DViewProps {
  onClose: () => void;
  editorPosition: { x: number; y: number };
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  isVisible: boolean;
  robotState: RobotState;
  optimizedPath: OptimizedPathPoint[];
  displayTime: number;
  totalPathTime: number;
  fieldWidth: number;
  fieldHeight: number;
}

const Floating3DView: React.FC<Floating3DViewProps> = ({
  onClose,
  editorPosition,
  onDragStart,
  isVisible,
  robotState,
  optimizedPath,
  displayTime,
  totalPathTime,
  fieldWidth,
  fieldHeight,
}) => {
  if (!isVisible) return null;

  const FallbackField = () => {
    const geometry = new THREE.PlaneGeometry(fieldWidth, fieldHeight);
    const material = new THREE.MeshStandardMaterial({ color: '#00ff00', side: THREE.DoubleSide }); // Bright green for visibility
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <primitive object={geometry} />
        <primitive object={material} />
      </mesh>
    );
  };

  return (
    <div
      className="fixed bg-gray-800 border border-gray-700 shadow-xl rounded-lg text-white z-50"
      style={{
        left: editorPosition.x,
        top: editorPosition.y,
        width: '600px',
        height: '400px',
        cursor: 'move',
      }}
      onMouseDown={onDragStart}
    >
      <div className="flex justify-between items-center p-2 bg-gray-700 rounded-t-lg">
        <span className="font-semibold">3D View</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-2 h-[calc(100%-40px)]" style={{ cursor: 'auto' }}>
        <Canvas camera={{ position: [0, 10, 15], fov: 50 }}>
          <ambientLight intensity={2} />
          <directionalLight position={[10, 10, 5]} intensity={20} />
          <directionalLight position={[-10, 10, -5]} intensity={20} />
          <directionalLight position={[0, 10, 0]} intensity={20} />
          
          {/* Render the field (GLB or fallback plane) */}
          <Suspense fallback={<FallbackField />}>
            <FieldModel fieldWidth={fieldWidth} fieldHeight={fieldHeight} />
          </Suspense>

          <RobotInScene robotState={robotState} fieldWidth={fieldWidth} fieldHeight={fieldHeight} />
          <PathVisualizer pathPoints={optimizedPath} fieldWidth={fieldWidth} fieldHeight={fieldHeight} />
          <TimeIndicator
            pathPoints={optimizedPath}
            currentTime={displayTime}
            totalPathTime={totalPathTime}
            fieldWidth={fieldWidth}
            fieldHeight={fieldHeight}
          />
          
          <OrbitControls target={[0, 0, 0]} />
          <gridHelper args={[Math.max(fieldWidth, fieldHeight), 20]} />
        </Canvas>
      </div>
    </div>
  );
};

export default Floating3DView;