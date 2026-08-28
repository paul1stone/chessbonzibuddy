export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface PieceState {
  id: string;
  type: PieceType;
  color: Color;
  square: Square;
}

export interface Ply {
  from: Square;
  to: Square;
  captures?: Square;
}

export interface RenderPiece {
  id: string;
  type: PieceType;
  color: Color;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  captured: boolean;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

// 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#
export const SCHOLARS_MATE: Ply[] = [
  { from: "e2", to: "e4" },
  { from: "e7", to: "e5" },
  { from: "d1", to: "h5" },
  { from: "b8", to: "c6" },
  { from: "f1", to: "c4" },
  { from: "g8", to: "f6" },
  { from: "h5", to: "f7", captures: "f7" },
];

export const MOVE_START = 0.1;
export const MOVE_END = 0.85;
export const LIFT = 0.6;
export const TUMBLE = 0.15;
export const HIDE_BELOW_Y = -1.5;

export const CAM_TOP: CameraPose = { position: [0, 11, 2.5], target: [0, 0, 0] };
export const CAM_LOW: CameraPose = { position: [6, 3.2, 7], target: [0, 0, 0] };

const FILES = "abcdefgh";
const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export const INITIAL_PIECES: PieceState[] = (() => {
  const out: PieceState[] = [];
  for (let f = 0; f < 8; f++) {
    const file = FILES[f];
    out.push({ id: `w${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "w", square: `${file}1` as Square });
    out.push({ id: `wp${f}`, type: "p", color: "w", square: `${file}2` as Square });
    out.push({ id: `bp${f}`, type: "p", color: "b", square: `${file}7` as Square });
    out.push({ id: `b${BACK_RANK[f]}${f}`, type: BACK_RANK[f], color: "b", square: `${file}8` as Square });
  }
  return out;
})();

export function squareToXZ(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return [file - 3.5, 3.5 - rank];
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface ActiveMove {
  id: string;
  from: Square;
  to: Square;
  t: number;
}

export function boardAt(progress: number): RenderPiece[] {
  const p = clamp01(progress);
  const squares = new Map<string, Square>(INITIAL_PIECES.map((pc) => [pc.id, pc.square]));
  const capturedAt = new Map<string, number>();
  const sliceLen = (MOVE_END - MOVE_START) / SCHOLARS_MATE.length;

  const occupant = (square: Square) => {
    for (const [id, sq] of squares) {
      if (sq === square && !capturedAt.has(id)) return id;
    }
    throw new Error(`no piece on ${square}`);
  };

  let active: ActiveMove | null = null;

  SCHOLARS_MATE.forEach((ply, i) => {
    const start = MOVE_START + i * sliceLen;
    const end = start + sliceLen;
    if (p < start) return;
    const mover = occupant(ply.from);
    if (p >= end) {
      if (ply.captures) capturedAt.set(occupant(ply.captures), start + sliceLen / 2);
      squares.set(mover, ply.to);
      return;
    }
    const t = easeInOutQuad((p - start) / sliceLen);
    if (ply.captures && t > 0.5) capturedAt.set(occupant(ply.captures), start + sliceLen / 2);
    active = { id: mover, from: ply.from, to: ply.to, t };
  });

  return INITIAL_PIECES.map((pc) => {
    const yaw = pc.color === "b" ? Math.PI : 0;
    const base = { id: pc.id, type: pc.type, color: pc.color };
    const capTime = capturedAt.get(pc.id);

    if (capTime !== undefined) {
      const u = clamp01((p - capTime) / TUMBLE);
      const [x0, z0] = squareToXZ(squares.get(pc.id)!);
      return {
        ...base,
        x: x0 + 1.6 * u,
        y: 1.2 * u - 3 * u * u,
        z: z0 - 0.4 * u,
        yaw: yaw + u * Math.PI * 2,
        pitch: u * Math.PI,
        captured: true,
      };
    }

    if (active && active.id === pc.id) {
      const [x0, z0] = squareToXZ(active.from);
      const [x1, z1] = squareToXZ(active.to);
      const t = active.t;
      return {
        ...base,
        x: x0 + (x1 - x0) * t,
        y: Math.sin(t * Math.PI) * LIFT,
        z: z0 + (z1 - z0) * t,
        yaw,
        pitch: 0,
        captured: false,
      };
    }

    const [x, z] = squareToXZ(squares.get(pc.id)!);
    return { ...base, x, y: 0, z, yaw, pitch: 0, captured: false };
  });
}

export function cameraAt(progress: number): CameraPose {
  const u = easeInOutCubic(clamp01(clamp01(progress) / MOVE_END));
  const lerp = (a: number, b: number) => a + (b - a) * u;
  return {
    position: [
      lerp(CAM_TOP.position[0], CAM_LOW.position[0]),
      lerp(CAM_TOP.position[1], CAM_LOW.position[1]),
      lerp(CAM_TOP.position[2], CAM_LOW.position[2]),
    ],
    target: [0, 0, 0],
  };
}
