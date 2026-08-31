"use client";

import { useCallback, useMemo, type SyntheticEvent } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
  type MouseHandlerDataParam,
} from "recharts";
import { formatEval } from "@/lib/analysis-utils";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { MoveAnalysis, MoveClassification } from "@/lib/engine";

interface EvalChartProps {
  moves: MoveAnalysis[];
  currentMove: number;
  onMoveClick: (moveIndex: number) => void;
}

/** Clamp evaluation to the display range of -5 to +5 (pawns). */
function clampEval(cp: number): number {
  const pawns = cp / 100;
  return Math.max(-5, Math.min(5, pawns));
}

const NOTABLE_CLASSIFICATIONS = new Set<MoveClassification>([
  "blunder",
  "mistake",
  "inaccuracy",
]);

interface ChartDataPoint {
  index: number;
  moveLabel: string;
  eval: number;
  evalText: string;
  classification: MoveClassification;
  san: string;
  isNotable: boolean;
}

export function EvalChart({ moves, currentMove, onMoveClick }: EvalChartProps) {
  const data = useMemo<ChartDataPoint[]>(() => {
    return moves.map((m, i) => ({
      index: i,
      moveLabel:
        m.color === "w"
          ? `${m.moveNumber}.`
          : `${m.moveNumber}...`,
      eval: clampEval(m.evalAfter),
      evalText: formatEval(m.evalAfter, m.mateAfter),
      classification: m.classification,
      san: m.san,
      isNotable: NOTABLE_CLASSIFICATIONS.has(m.classification),
    }));
  }, [moves]);

  const handleChartClick = useCallback(
    (nextState: MouseHandlerDataParam, _event: SyntheticEvent) => {
      const idx = nextState.activeTooltipIndex;
      if (typeof idx === "number") {
        onMoveClick(idx);
      }
    },
    [onMoveClick]
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
        onClick={handleChartClick}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#808080"
          vertical={false}
        />
        <XAxis
          dataKey="moveLabel"
          tick={{ fill: "#404040", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#808080" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-5, 5]}
          tick={{ fill: "#404040", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#808080" }}
          tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
          ticks={[-5, -2.5, 0, 2.5, 5]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0]?.payload as ChartDataPoint | undefined;
            if (!point) return null;
            return (
              <div className="r-face r-bevel-out px-3 py-2 text-xs">
                <p className="font-bold">
                  {point.moveLabel} {point.san}
                </p>
                <p className="text-muted-foreground">
                  Eval: {point.evalText}
                </p>
                {point.isNotable && (
                  <p
                    className="mt-0.5 font-medium capitalize"
                    style={{
                      color: CLASSIFICATION_COLORS[point.classification].hex,
                    }}
                  >
                    {point.classification}
                  </p>
                )}
              </div>
            );
          }}
        />
        {/* Zero line */}
        <ReferenceLine y={0} stroke="#808080" strokeWidth={1} />
        {/* Current move indicator */}
        {currentMove >= 0 && currentMove < data.length && (
          <ReferenceLine
            x={data[currentMove]?.moveLabel}
            stroke="#800000"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        <Area
          type="monotone"
          dataKey="eval"
          stroke="#000080"
          strokeWidth={1.5}
          fill="#000080"
          fillOpacity={0.15}
          baseValue={0}
          isAnimationActive={false}
          dot={(props) => {
            const { cx, cy, payload } = props as {
              cx: number;
              cy: number;
              payload: ChartDataPoint;
            };
            if (!payload?.isNotable) return <g key={`dot-${payload?.index}`} />;
            return (
              <circle
                key={`dot-${payload.index}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={CLASSIFICATION_COLORS[payload.classification].hex}
                stroke="#000000"
                strokeWidth={1}
              />
            );
          }}
          activeDot={{
            r: 4,
            fill: "#000080",
            stroke: "#ffffff",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
