"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D, type Mesh } from "three";
import { boardAt, cameraAt, HIDE_BELOW_Y, INITIAL_PIECES, type PieceType } from "./hero-timeline";
import { createPieceGeometry } from "./piece-geometry";

const LIGHT_SQUARE = new Color("#d9c9a3");
const DARK_SQUARE = new Color("#6e4b2a");
const PIECE_TYPES: PieceType[] = ["p", "n", "b", "r", "q", "k"];
const IDLE_PERIOD = 12;
const IDLE_AMPLITUDE = (3 * Math.PI) / 180;

function Board() {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let i = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        dummy.position.set(file - 3.5, -0.05, 3.5 - rank);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, (file + rank) % 2 === 0 ? DARK_SQUARE : LIGHT_SQUARE);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 64]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[8.6, 0.12, 8.6]} />
        <meshLambertMaterial color="#3a2a1a" flatShading />
      </mesh>
    </group>
  );
}

function Pieces({ progressRef }: { progressRef: RefObject<number> }) {
  const geometries = useMemo(
    () => Object.fromEntries(PIECE_TYPES.map((t) => [t, createPieceGeometry(t)])) as Record<PieceType, ReturnType<typeof createPieceGeometry>>,
    []
  );
  const white = useMemo(() => new MeshLambertMaterial({ color: "#f0e6d2", flatShading: true }), []);
  const black = useMemo(() => new MeshLambertMaterial({ color: "#2b2b2b", flatShading: true }), []);
  const meshes = useRef(new Map<string, Mesh>());

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      white.dispose();
      black.dispose();
    };
  }, [geometries, white, black]);

  useFrame(() => {
    for (const piece of boardAt(progressRef.current)) {
      const mesh = meshes.current.get(piece.id);
      if (!mesh) continue;
      mesh.position.set(piece.x, piece.y, piece.z);
      mesh.rotation.set(piece.pitch, piece.yaw, 0);
      mesh.visible = !(piece.captured && piece.y < HIDE_BELOW_Y);
    }
  });

  return (
    <>
      {INITIAL_PIECES.map((piece) => (
        <mesh
          key={piece.id}
          ref={(el) => {
            if (el) meshes.current.set(piece.id, el);
            else meshes.current.delete(piece.id);
          }}
          geometry={geometries[piece.type]}
          material={piece.color === "w" ? white : black}
        />
      ))}
    </>
  );
}

function CameraRig({ progressRef }: { progressRef: RefObject<number> }) {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const { position, target } = cameraAt(progressRef.current);
    const idle = Math.sin((clock.elapsedTime * Math.PI * 2) / IDLE_PERIOD) * IDLE_AMPLITUDE;
    const c = Math.cos(idle);
    const s = Math.sin(idle);
    camera.position.set(position[0] * c - position[2] * s, position[1], position[0] * s + position[2] * c);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

export function ChessScene({ progressRef }: { progressRef: RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[-4, 8, 3]} intensity={2.6} color="#fff2d8" />
      <Board />
      <Pieces progressRef={progressRef} />
      <CameraRig progressRef={progressRef} />
    </>
  );
}
