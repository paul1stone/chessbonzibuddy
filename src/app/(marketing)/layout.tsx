import { msSans, vt323 } from "@/fonts/retro-fonts";
import { Taskbar } from "@/components/retro";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`retro ${msSans.variable} ${vt323.variable} min-h-screen pb-[var(--r-taskbar-h)]`}>
      {children}
      <Taskbar />
    </div>
  );
}
