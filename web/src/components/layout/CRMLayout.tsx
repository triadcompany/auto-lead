import React from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CRMSidebarWithAuth } from "./CRMSidebarWithAuth";
import { LeadNotificationManager } from "@/components/notifications/LeadNotificationManager";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { SubscriptionGate } from "@/components/billing/SubscriptionGate";
import { SidebarVisibilityProvider, useSidebarVisibility } from "@/contexts/SidebarVisibilityContext";

interface CRMLayoutProps {
  children?: React.ReactNode;
}

function CRMLayoutInner({ children }: CRMLayoutProps) {
  const { hidden } = useSidebarVisibility();

  return (
    <SidebarProvider>
      <LeadNotificationManager />
      <InstallPrompt />
      <UpdatePrompt />
      <OfflineIndicator />
      <div className="min-h-screen flex flex-col w-full bg-background">
        <TrialBanner />
        <div className="flex flex-1 overflow-hidden">
          {!hidden && <CRMSidebarWithAuth />}
          <main className="flex-1 overflow-hidden md:overflow-auto">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function CRMLayout({ children }: CRMLayoutProps) {
  return (
    <SubscriptionGate>
      <SidebarVisibilityProvider>
        <CRMLayoutInner>{children}</CRMLayoutInner>
      </SidebarVisibilityProvider>
    </SubscriptionGate>
  );
}