"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoveList } from "./move-list";
import { GameSummary } from "./game-summary";
import { EnginePanel } from "./engine-panel";
import type { MoveAnalysis } from "@/lib/engine";

interface ReviewPanelProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
  whiteAccuracy: number;
  blackAccuracy: number;
  currentMoveAnalysis: MoveAnalysis | null;
}

export function ReviewPanel({
  moves,
  currentMove,
  onMoveClick,
  whiteAccuracy,
  blackAccuracy,
  currentMoveAnalysis,
}: ReviewPanelProps) {
  // Compute eval and mate for the EnginePanel from the current move analysis
  const evaluation = currentMoveAnalysis?.evalAfter ?? 0;
  // MoveAnalysis doesn't carry a mate field directly, so we pass null
  const mate: number | null = null;

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
        <ScrollArea className="h-full">
          <div className="p-4">
            <GameSummary
              moves={moves}
              whiteAccuracy={whiteAccuracy}
              blackAccuracy={blackAccuracy}
              currentMove={currentMove}
              onMoveClick={onMoveClick}
            />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="engine" className="min-h-0 flex-1">
        <div className="p-4">
          <EnginePanel
            currentMoveAnalysis={currentMoveAnalysis}
            eval={evaluation}
            mate={mate}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
