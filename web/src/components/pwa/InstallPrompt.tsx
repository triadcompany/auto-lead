import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show prompt after a delay if not installed
    if (iOS && !isInstalled) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installed');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-slide-up">
      <Card className="shadow-2xl border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Instalar AutoLead</CardTitle>
                <CardDescription className="text-xs">
                  Acesso rápido e offline
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
        <CardContent className="space-y-4 pb-4">
          {isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para instalar no iOS:
              </p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>
                    Toque no ícone de <Share className="inline h-4 w-4 mx-1" /> <strong>Compartilhar</strong> na barra inferior
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>
                    Role para baixo e toque em <Plus className="inline h-4 w-4 mx-1" /> <strong>"Adicionar à Tela de Início"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                </li>
              </ol>
              <div className="pt-2 flex gap-2">
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  className="flex-1"
                >
                  Entendi
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Instale o app para acesso rápido e use offline!
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleInstallClick}
                  className="flex-1"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Instalar App
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="lg"
                >
                  Agora não
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
