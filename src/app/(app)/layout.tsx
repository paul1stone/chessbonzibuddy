import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Toaster } from "@/components/ui/sonner";
import { ViewParamSync } from "./app/view-param-sync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dark ${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
      <Suspense fallback={null}>
        <ViewParamSync />
      </Suspense>
      <DashboardLayout>{children}</DashboardLayout>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
