"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Chess } from "chess.js";
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
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Clear selection when position or interactivity changes
  useEffect(() => {
    setSelectedSquare(null);
  }, [position, interactive]);

  // Compute legal moves for the selected square
  const legalMoves = useMemo(() => {
    if (!selectedSquare || !interactive || !position) return [];
    try {
      const game = new Chess(position);
      return game.moves({ square: selectedSquare as never, verbose: true });
    } catch {
      return [];
    }
  }, [selectedSquare, interactive, position]);

  // Build square styles for selected piece + legal move dots
  const clickMoveStyles = useMemo(() => {
    if (!interactive || !selectedSquare) return {};
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight selected square
    styles[selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };

    for (const move of legalMoves) {
      if (move.captured) {
        // Capture target: ring around the edge (like chess.com)
        styles[move.to] = {
          background:
            "radial-gradient(transparent 51%, rgba(0,0,0,0.15) 51%)",
          cursor: "pointer",
        };
      } else {
        // Empty square: small centered dot
        styles[move.to] = {
          background:
            "radial-gradient(rgba(0,0,0,0.2) 25%, transparent 25%)",
          cursor: "pointer",
        };
      }
    }

    return styles;
  }, [interactive, selectedSquare, legalMoves]);

  const handleSquareClick = useCallback(
    ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
      if (!interactive) return;

      const sideToMove = position ? position.split(" ")[1] : "w";
      const isOwnPiece = piece ? piece.pieceType[0] === sideToMove : false;

      // If a piece is selected and we click a legal target, make the move
      if (selectedSquare && selectedSquare !== square) {
        const isLegalTarget = legalMoves.some((m) => m.to === square);
        if (isLegalTarget && onPieceDrop) {
          onPieceDrop(selectedSquare, square, "");
          setSelectedSquare(null);
          return;
        }
      }

      // Select/deselect own piece
      if (isOwnPiece) {
        setSelectedSquare(square === selectedSquare ? null : square);
      } else {
        setSelectedSquare(null);
      }
    },
    [interactive, selectedSquare, legalMoves, onPieceDrop, position]
  );

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
          squareStyles: clickMoveStyles,
          lightSquareStyle: { backgroundColor: "#e8dab2" },
          darkSquareStyle: { backgroundColor: "#4a7c59" },
          dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(0,0,0,.1)" },
          boardStyle: {
            ...(boardWidth ? { width: boardWidth } : {}),
          },
          onSquareClick: interactive ? handleSquareClick : undefined,
          onPieceDrop: onPieceDrop
            ? ({ piece, sourceSquare, targetSquare }) => {
                if (!targetSquare) return false;
                setSelectedSquare(null);
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
