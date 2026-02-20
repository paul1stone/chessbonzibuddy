"use client";

import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard";

interface BoardProps {
  position?: string; // FEN string
  onPieceDrop?: (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ) => boolean;
  boardWidth?: number;
  interactive?: boolean;
  boardOrientation?: "white" | "black";
  customArrows?: Array<[string, string, string?]>; // [from, to, color?]
}

export function Board({
  position,
  onPieceDrop,
  boardWidth,
  interactive = true,
  boardOrientation = "white",
  customArrows,
}: BoardProps) {
  // Convert the simplified arrow format to the react-chessboard Arrow type
  const arrows: Arrow[] | undefined = customArrows?.map(
    ([startSquare, endSquare, color]) => ({
      startSquare,
      endSquare,
      color: color ?? "rgba(255, 170, 0, 0.8)",
    })
  );

  return (
    <div className="rounded-lg overflow-hidden shadow-xl">
      <Chessboard
        options={{
          position: position ?? "start",
          boardOrientation,
          animationDurationInMs: 200,
          allowDragging: interactive,
          arrows,
          lightSquareStyle: { backgroundColor: "#e8dab2" },
          darkSquareStyle: { backgroundColor: "#4a7c59" },
          dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(0,0,0,.1)" },
          boardStyle: {
            ...(boardWidth ? { width: boardWidth } : {}),
          },
          onPieceDrop: onPieceDrop
            ? ({ piece, sourceSquare, targetSquare }) => {
                if (!targetSquare) return false;
                return onPieceDrop(
                  sourceSquare,
                  targetSquare,
                  piece.pieceType
                );
              }
            : undefined,
        }}
      />
    </div>
  );
}
