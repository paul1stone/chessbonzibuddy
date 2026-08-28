import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  variant?: "normal" | "default";
  size?: "md" | "lg";
  children: ReactNode;
}

export function RetroButton({
  href,
  variant = "normal",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: RetroButtonProps) {
  const cls = cn("r-btn", variant === "default" && "r-btn--default", size === "lg" && "r-btn--lg", className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
