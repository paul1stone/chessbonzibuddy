import { msSans, vt323 } from "@/fonts/retro-fonts";
import { MarketingTaskbar } from "@/components/landing/marketing-taskbar";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`retro ${msSans.variable} ${vt323.variable} min-h-screen pb-[var(--r-taskbar-h)]`}>
      {children}
      <MarketingTaskbar />
    </div>
  );
}
