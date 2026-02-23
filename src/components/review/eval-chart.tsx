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
            <stop offset="0%" stopColor="#e9d5ff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#e9d5ff" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="evalGradientNeg" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#7e22ce" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.02} />
          </linearGradient>
          {/* Split gradient: white above 0, dark below 0 */}
          <linearGradient id="evalSplit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9d5ff" stopOpacity={0.35} />
            <stop offset="50%" stopColor="#e9d5ff" stopOpacity={0.05} />
            <stop offset="50%" stopColor="#7e22ce" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#581c87"
          vertical={false}
        />
        <XAxis
          dataKey="moveLabel"
          tick={{ fill: "#a855f7", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#6b21a8" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-5, 5]}
          tick={{ fill: "#a855f7", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#6b21a8" }}
          tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
          ticks={[-5, -2.5, 0, 2.5, 5]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0]?.payload as ChartDataPoint | undefined;
            if (!point) return null;
            return (
              <div className="rounded-md border border-purple-700 bg-purple-900 px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-purple-100">
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
                        "#a855f7",
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
        <ReferenceLine y={0} stroke="#7e22ce" strokeWidth={1} />
        {/* Current move indicator */}
        {currentMove >= 0 && currentMove < data.length && (
          <ReferenceLine
            x={data[currentMove]?.moveLabel}
            stroke="#c084fc"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        <Area
          type="monotone"
          dataKey="eval"
          stroke="#c084fc"
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
              classificationDotColor[payload.classification] ?? "#a855f7";
            return (
              <circle
                key={`dot-${payload.index}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={dotColor}
                stroke="#3b0764"
                strokeWidth={1}
              />
            );
          }}
          activeDot={{
            r: 4,
            fill: "#e9d5ff",
            stroke: "#3b0764",
            strokeWidth: 1.5,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
