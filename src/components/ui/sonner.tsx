"use client"

import type { ReactNode } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Win98 message-box glyphs: flat fills on a 16px grid, no anti-aliasing. */
function PixelGlyph({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <PixelGlyph>
            <path
              d="M2 8 L6 12 L14 4"
              fill="none"
              stroke="#008000"
              strokeWidth="3"
            />
          </PixelGlyph>
        ),
        info: (
          <PixelGlyph>
            <circle cx="8" cy="8" r="7" fill="var(--r-title-a)" />
            <rect x="7" y="3" width="2" height="2" fill="#ffffff" />
            <rect x="7" y="6" width="2" height="7" fill="#ffffff" />
          </PixelGlyph>
        ),
        warning: (
          <PixelGlyph>
            <path d="M8 1 L15 14 L1 14 Z" fill="#ffff00" stroke="#000000" />
            <rect x="7" y="6" width="2" height="4" fill="#000000" />
            <rect x="7" y="11" width="2" height="2" fill="#000000" />
          </PixelGlyph>
        ),
        error: (
          <PixelGlyph>
            <circle cx="8" cy="8" r="7" fill="#c00000" />
            <path d="M5 5 L11 11 M11 5 L5 11" stroke="#ffffff" strokeWidth="2" />
          </PixelGlyph>
        ),
        loading: (
          <PixelGlyph className="animate-spin">
            <rect x="7" y="1" width="2" height="4" fill="var(--r-title-a)" />
            <rect x="11" y="7" width="4" height="2" fill="var(--r-shadow)" />
            <rect x="7" y="11" width="2" height="4" fill="var(--r-shadow)" />
            <rect x="1" y="7" width="4" height="2" fill="var(--r-shadow)" />
          </PixelGlyph>
        ),
      }}
      toastOptions={{
        // Inline: sonner styles the bevel away from a class via
        // `[data-sonner-toast][data-styled]`, which outranks any class we add.
        style: {
          fontFamily: "var(--font-ui), sans-serif",
          fontSize: "12px",
          padding: "10px 12px",
          border: "none",
          boxShadow:
            "inset -1px -1px var(--r-dark), inset 1px 1px var(--r-highlight), inset -2px -2px var(--r-shadow), inset 2px 2px var(--r-face-light)",
        },
      }}
      style={
        {
          "--normal-bg": "var(--r-face)",
          "--normal-text": "var(--r-dark)",
          // The toast itself draws no border — the bevel is the edge. These two
          // are what the close button reads: its border is var(--gray4), which
          // otherwise falls back to sonner's near-white.
          "--normal-border": "var(--r-shadow)",
          "--gray4": "var(--r-shadow)",
          "--border-radius": "0px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
