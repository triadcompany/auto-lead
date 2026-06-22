import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let intervalId: number | undefined;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          setRegistration(reg);
          setShowPrompt(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setRegistration(reg);
                setShowPrompt(true);
              }
            });
          }
        });

        // Check for updates every hour
        intervalId = window.setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);
      });
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      registration.waiting.addEventListener('statechange', (e) => {
        const target = e.target as ServiceWorker;
        if (target.state === 'activated') {
          window.location.reload();
        }
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-20 md:top-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-slide-down">
      <Card className="shadow-2xl border-2 border-primary/20 bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Atualização Disponível</CardTitle>
                <CardDescription className="text-xs">
                  Nova versão do app
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mt-1 -mr-2"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-sm text-muted-foreground">
            Uma nova versão do AutoLead está disponível com melhorias e correções.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleUpdate}
              className="flex-1"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Agora
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              size="sm"
            >
              Depois
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
