import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PieceType } from "./hero-timeline";

const SEGMENTS = 10;

// [radius, height] pairs, bottom to top, in board-square units.
const PROFILES: Record<Exclude<PieceType, "n">, [number, number][]> = {
  p: [[0, 0], [0.32, 0], [0.32, 0.06], [0.22, 0.12], [0.14, 0.3], [0.11, 0.36], [0.19, 0.4], [0.16, 0.47], [0.09, 0.55], [0, 0.55]],
  r: [[0, 0], [0.34, 0], [0.34, 0.08], [0.25, 0.14], [0.22, 0.5], [0.3, 0.55], [0.3, 0.7], [0.18, 0.7], [0.18, 0.62], [0, 0.62]],
  b: [[0, 0], [0.33, 0], [0.33, 0.07], [0.2, 0.14], [0.14, 0.45], [0.21, 0.55], [0.17, 0.68], [0.08, 0.76], [0, 0.8]],
  q: [[0, 0], [0.36, 0], [0.36, 0.08], [0.23, 0.16], [0.14, 0.55], [0.23, 0.7], [0.19, 0.78], [0.25, 0.85], [0.11, 0.9], [0, 0.9]],
  k: [[0, 0], [0.36, 0], [0.36, 0.08], [0.23, 0.16], [0.14, 0.6], [0.23, 0.76], [0.19, 0.84], [0.1, 0.9], [0, 0.9]],
};

// Knight silhouette (x, y), counter-clockwise, base centered on x=0.
const KNIGHT: [number, number][] = [
  [-0.28, 0], [0.28, 0], [0.28, 0.08], [0.18, 0.14], [0.16, 0.36], [0.3, 0.5], [0.34, 0.62],
  [0.22, 0.75], [0.02, 0.72], [-0.1, 0.6], [-0.06, 0.5], [-0.18, 0.4], [-0.18, 0.14], [-0.28, 0.08],
];

export const PIECE_HEIGHTS: Record<PieceType, number> = {
  p: 0.55,
  n: 0.75,
  b: 0.8,
  r: 0.7,
  q: 0.98,
  k: 1.12,
};

function lathe(profile: [number, number][]): BufferGeometry {
  return new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), SEGMENTS);
}

function finish(geo: BufferGeometry): BufferGeometry {
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

export function createPieceGeometry(type: PieceType): BufferGeometry {
  switch (type) {
    case "n": {
      const shape = new Shape(KNIGHT.map(([x, y]) => new Vector2(x, y)));
      const geo = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
      geo.translate(0, 0, -0.15);
      return finish(geo);
    }
    case "q": {
      const body = lathe(PROFILES.q);
      const crown = new SphereGeometry(0.08, 6, 4);
      crown.translate(0, 0.9, 0);
      return finish(mergeGeometries([body, crown].map((g) => g.toNonIndexed()), false)!);
    }
    case "k": {
      const body = lathe(PROFILES.k);
      const post = new BoxGeometry(0.06, 0.22, 0.06);
      post.translate(0, 1.01, 0);
      const bar = new BoxGeometry(0.18, 0.06, 0.06);
      bar.translate(0, 1.03, 0);
      return finish(mergeGeometries([body, post, bar].map((g) => g.toNonIndexed()), false)!);
    }
    default:
      return finish(lathe(PROFILES[type]));
  }
}
