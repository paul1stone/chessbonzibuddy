import { msSans, vt323 } from "@/fonts/retro-fonts";
import { BootCascade } from "@/components/landing/boot-cascade";
import { MarketingTaskbar } from "@/components/landing/marketing-taskbar";

// Pre-paint gate for the boot cascade: landing page only, once per session, motion only.
const BOOT_GATE = `try{if(location.pathname==="/"&&!sessionStorage.getItem("cbb-booted")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("boot-pending")}catch(e){}`;

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`retro ${msSans.variable} ${vt323.variable} min-h-screen pb-[var(--r-taskbar-h)]`}>
      <script dangerouslySetInnerHTML={{ __html: BOOT_GATE }} />
      {children}
      <MarketingTaskbar />
      <BootCascade />
    </div>
  );
}
