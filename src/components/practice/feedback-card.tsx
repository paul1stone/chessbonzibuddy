"use client";

import { Check, X, Eye, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FeedbackCardProps {
  isCorrect: boolean | null;
  bestMoveSan: string;
  playedMoveSan: string | null;
  evalDiff: number; // how much better the best move is (in pawns)
  onNextMistake: () => void;
  onTryAgain: () => void;
  onShowAnswer: () => void;
  hasNextMistake: boolean;
  sideToMove: "w" | "b";
}

export function FeedbackCard({
  isCorrect,
  bestMoveSan,
  playedMoveSan,
  evalDiff,
  onNextMistake,
  onTryAgain,
  onShowAnswer,
  hasNextMistake,
  sideToMove,
}: FeedbackCardProps) {
  // Before attempt
  if (isCorrect === null && playedMoveSan === null) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Find the best move</CardTitle>
          <CardDescription className="text-zinc-400">
            {sideToMove === "w" ? "White" : "Black"} to move. Drag a piece to
            make your move.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-4 py-3">
            <div
              className={`h-4 w-4 rounded-full ${
                sideToMove === "w" ? "bg-white" : "bg-zinc-700 border border-zinc-500"
              }`}
            />
            <span className="text-sm text-zinc-300">
              {sideToMove === "w" ? "White" : "Black"} to play
            </span>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowAnswer}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
          >
            <Eye className="h-4 w-4" />
            Show Answer
          </Button>
          {hasNextMistake && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextMistake}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Skip
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Correct
  if (isCorrect === true) {
    return (
      <Card className="border-green-800/50 bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-400">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-4 w-4" />
            </div>
            Correct!
          </CardTitle>
          <CardDescription className="text-zinc-400">
            You found the best move: <span className="font-semibold text-green-400">{bestMoveSan}</span>
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          {hasNextMistake ? (
            <Button
              size="sm"
              onClick={onNextMistake}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Next Mistake
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-sm text-zinc-500">
              All mistakes reviewed!
            </span>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Incorrect
  return (
    <Card className="border-orange-800/50 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-400">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20">
            <X className="h-4 w-4" />
          </div>
          Not quite
        </CardTitle>
        <CardDescription className="text-zinc-400">
          {playedMoveSan && (
            <span>
              You played <span className="font-semibold text-zinc-300">{playedMoveSan}</span>.{" "}
            </span>
          )}
          The best move was:{" "}
          <span className="font-semibold text-green-400">{bestMoveSan}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {evalDiff > 0 && (
          <div className="rounded-lg bg-zinc-800/50 px-4 py-3">
            <p className="text-sm text-zinc-400">
              The best move is{" "}
              <span className="font-semibold text-orange-400">
                +{evalDiff.toFixed(1)} pawns
              </span>{" "}
              better
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTryAgain}
          className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        {hasNextMistake && (
          <Button
            size="sm"
            onClick={onNextMistake}
            className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
          >
            Next Mistake
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
