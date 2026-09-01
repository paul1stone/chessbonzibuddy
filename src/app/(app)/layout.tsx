import { Suspense } from "react";
import { msSans, vt323 } from "@/fonts/retro-fonts";
import { AppBoot } from "@/components/desktop/app-boot";
import { BonziPeek } from "@/components/desktop/bonzi-peek";
import { Toaster } from "@/components/ui/sonner";
import { ViewParamSync } from "./app/view-param-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // min-h-screen keeps the teal desktop painted behind macOS overscroll.
    <div
      className={`retro app ${msSans.variable} ${vt323.variable} min-h-screen overscroll-none`}
    >
      <Suspense fallback={null}>
        <ViewParamSync />
      </Suspense>
      {children}
      <AppBoot />
      <BonziPeek />
      <Toaster
        position="bottom-right"
        offset={{ bottom: 38 }}
        mobileOffset={{ bottom: 38 }}
      />
    </div>
  );
}
