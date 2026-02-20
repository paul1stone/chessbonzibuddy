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

const classificationDotColor: Partial<Record<MoveClassification, string>> = {
  blunder: "#ef4444", // red-500
  mistake: "#f97316", // orange-500
  inaccuracy: "#eab308", // yellow-500
};

interface ChartDataPoint {
  index: number;
  moveLabel: string;
  eval: number;
  rawEval: number;
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
      rawEval: m.evalAfter / 100,
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
        <defs>
          <linearGradient id="evalGradientPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e4e4e7" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#e4e4e7" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="evalGradientNeg" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#52525b" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#52525b" stopOpacity={0.02} />
          </linearGradient>
          {/* Split gradient: white above 0, dark below 0 */}
          <linearGradient id="evalSplit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e4e4e7" stopOpacity={0.35} />
            <stop offset="50%" stopColor="#e4e4e7" stopOpacity={0.05} />
            <stop offset="50%" stopColor="#52525b" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#52525b" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="moveLabel"
          tick={{ fill: "#71717a", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#3f3f46" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-5, 5]}
          tick={{ fill: "#71717a", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#3f3f46" }}
          tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
          ticks={[-5, -2.5, 0, 2.5, 5]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0]?.payload as ChartDataPoint | undefined;
            if (!point) return null;
            return (
              <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-zinc-200">
                  {point.moveLabel} {point.san}
                </p>
                <p className="text-muted-foreground">
                  Eval: {point.rawEval > 0 ? "+" : ""}
                  {point.rawEval.toFixed(2)}
                </p>
                {point.isNotable && (
                  <p
                    className="mt-0.5 font-medium capitalize"
                    style={{
                      color:
                        classificationDotColor[point.classification] ??
                        "#71717a",
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
        <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
        {/* Current move indicator */}
        {currentMove >= 0 && currentMove < data.length && (
          <ReferenceLine
            x={data[currentMove]?.moveLabel}
            stroke="#a1a1aa"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        <Area
          type="monotone"
          dataKey="eval"
          stroke="#a1a1aa"
          strokeWidth={1.5}
          fill="url(#evalSplit)"
          baseValue={0}
          isAnimationActive={false}
          dot={(props) => {
            const { cx, cy, payload } = props as {
              cx: number;
              cy: number;
              payload: ChartDataPoint;
            };
            if (!payload?.isNotable) return <g key={`dot-${payload?.index}`} />;
            const dotColor =
              classificationDotColor[payload.classification] ?? "#71717a";
            return (
              <circle
                key={`dot-${payload.index}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={dotColor}
                stroke="#18181b"
                strokeWidth={1}
              />
            );
          }}
          activeDot={{
            r: 4,
            fill: "#e4e4e7",
            stroke: "#18181b",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
