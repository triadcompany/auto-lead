import { DevBanner } from "@/components/DevBanner";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CRMLayout } from "@/components/layout/CRMLayout";
import { ClerkProvider } from "@/providers/ClerkProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppGate } from "@/components/AppGate";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { Dashboard } from "@/pages/Dashboard";
import { Oportunidades } from "@/pages/Oportunidades";
import { Leads } from "@/pages/Leads";
import { Reports } from "@/pages/Reports";
import { Settings } from "@/pages/Settings";
import { Pipelines } from "@/pages/Pipelines";

import { Auth } from "@/pages/Auth";
import { SellerAuth } from "@/pages/SellerAuth";
import { ResetPassword } from "@/pages/ResetPassword";
import Invite from "@/pages/Invite";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";

import LandingPage from "./pages/LandingPage";
import Prospeccao from "./pages/Prospeccao";
import Automacoes from "./pages/Automacoes";
import Onboarding from "./pages/Onboarding";
import InboxPage from "./pages/Inbox";
import TreinarAgente from "./pages/TreinarAgente";
import AdminDebugAutomations from "./pages/AdminDebugAutomations";
import AutomationGuide from "./pages/AutomationGuide";
import AdminDiagnostico from "./pages/AdminDiagnostico";
import Broadcasts from "./pages/Broadcasts";
import BroadcastDetail from "./pages/BroadcastDetail";
import { TabBar } from "./components/mobile/TabBar";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { OfflineIndicator } from "./components/pwa/OfflineIndicator";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => {
  useEffect(() => {
    // Register service worker for PWA — only in production
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      let hasReloadedForNewWorker = false;

      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('Service Worker registered');

          registration.update().catch((err) => {
            console.log('Service Worker update check failed:', err);
          });

          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hasReloadedForNewWorker) return;
            hasReloadedForNewWorker = true;
            window.location.reload();
          });
        })
        .catch((err) => console.log('Service Worker registration failed:', err));
    } else if ('serviceWorker' in navigator && !import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
    }

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  }, []);

  return (
    // Nível 1: captura erros fora do Router (providers, contextos globais)
    <ErrorBoundary>
      <DevBanner />
      <ClerkProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  {/* ── Public routes ── */}
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/seller-auth" element={<SellerAuth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/invite" element={<Invite />} />

                  {/* ── Private routes — all under AppGate ── */}
                  <Route element={<AppGate />}>
                    <Route path="/onboarding" element={<Onboarding />} />

                    {/* Nível 2: captura erros de página sem derrubar o layout */}
                    <Route element={<CRMLayout />}>
                      <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                      <Route path="/oportunidades" element={<ErrorBoundary><Oportunidades /></ErrorBoundary>} />
                      <Route path="/leads" element={<ErrorBoundary><Leads /></ErrorBoundary>} />
                      <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
                      <Route path="/pipelines" element={<ErrorBoundary><Pipelines /></ErrorBoundary>} />
                      <Route path="/tarefas" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
                      <Route path="/automacoes" element={<ErrorBoundary><Automacoes /></ErrorBoundary>} />
                      <Route path="/automacoes/guia" element={<ErrorBoundary><AutomationGuide /></ErrorBoundary>} />
                      <Route path="/inbox" element={<ErrorBoundary><InboxPage /></ErrorBoundary>} />
                      <Route path="/broadcasts" element={<ErrorBoundary><Broadcasts /></ErrorBoundary>} />
                      <Route path="/broadcasts/:id" element={<ErrorBoundary><BroadcastDetail /></ErrorBoundary>} />

                      <Route path="/settings" element={<AdminRoute><ErrorBoundary><Settings /></ErrorBoundary></AdminRoute>} />
                      <Route path="/treinar-agente" element={<AdminRoute><ErrorBoundary><TreinarAgente /></ErrorBoundary></AdminRoute>} />
                      <Route path="/admin/debug/automations" element={<AdminRoute><ErrorBoundary><AdminDebugAutomations /></ErrorBoundary></AdminRoute>} />
                      <Route path="/admin/diagnostico" element={<AdminRoute><ErrorBoundary><AdminDiagnostico /></ErrorBoundary></AdminRoute>} />
                    </Route>
                  </Route>

                  {/* ── Catch-all ── */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <TabBar />
                <InstallPrompt />
                <UpdatePrompt />
                <OfflineIndicator />
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
};

export default App;