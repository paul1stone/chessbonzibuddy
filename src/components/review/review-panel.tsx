"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveList } from "./move-list";
import type { MoveAnalysis } from "@/lib/engine";

interface ReviewPanelProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
}

export function ReviewPanel({
  moves,
  currentMove,
  onMoveClick,
}: ReviewPanelProps) {
  return (
    <Tabs defaultValue="moves" className="flex h-full flex-col">
      <TabsList className="w-full shrink-0 bg-zinc-900">
        <TabsTrigger
          value="moves"
          className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
        >
          Moves
        </TabsTrigger>
        <TabsTrigger
          value="summary"
          className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
        >
          Summary
        </TabsTrigger>
        <TabsTrigger
          value="engine"
          className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
        >
          Engine
        </TabsTrigger>
      </TabsList>

      <TabsContent value="moves" className="min-h-0 flex-1">
        <MoveList
          moves={moves}
          currentMove={currentMove}
          onMoveClick={onMoveClick}
        />
      </TabsContent>

      <TabsContent value="summary" className="min-h-0 flex-1">
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Summary coming soon
        </div>
      </TabsContent>

      <TabsContent value="engine" className="min-h-0 flex-1">
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Engine analysis coming soon
        </div>
      </TabsContent>
    </Tabs>
  );
}
