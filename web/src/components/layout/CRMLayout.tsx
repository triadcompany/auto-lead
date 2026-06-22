import React from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CRMSidebarWithAuth } from "./CRMSidebarWithAuth";
import { LeadNotificationManager } from "@/components/notifications/LeadNotificationManager";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";

interface CRMLayoutProps {
  children?: React.ReactNode;
}

export function CRMLayout({ children }: CRMLayoutProps) {
  return (
    <SidebarProvider>
      <LeadNotificationManager />
      <InstallPrompt />
      <UpdatePrompt />
      <OfflineIndicator />
      <div className="min-h-screen flex w-full bg-background">
        <CRMSidebarWithAuth />
        <main className="flex-1 overflow-hidden md:overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </SidebarProvider>
  );
}