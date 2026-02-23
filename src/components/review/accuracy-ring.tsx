"use client";

interface AccuracyRingProps {
  accuracy: number; // 0-100
  label: string; // "White" or "Black"
  color: string; // ring color class (e.g. "stroke-white" for white, "stroke-purple-300" for black)
  size?: number; // diameter in px, default 100
}

export function AccuracyRing({
  accuracy,
  label,
  color,
  size = 100,
}: AccuracyRingProps) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (accuracy / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-purple-800"
          strokeWidth={strokeWidth}
        />
        {/* Foreground progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.8s ease-in-out",
          }}
        />
      </svg>
      {/* Center text */}
      <div className="flex flex-col items-center justify-center">
        <span
          className="font-bold text-purple-100"
          style={{ fontSize: size * 0.26 }}
        >
          {accuracy.toFixed(1)}
        </span>
        <span
          className="text-muted-foreground"
          style={{ fontSize: size * 0.13 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
