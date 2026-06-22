import { useEffect, useState } from "react";
import { Bell, Volume2, Vibrate } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NotificationPermissionPromptProps {
  onGranted: () => void;
}

export function NotificationPermissionPrompt({ onGranted }: NotificationPermissionPromptProps) {
  const [open, setOpen] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  useEffect(() => {
    const asked = localStorage.getItem('notification-permission-asked');
    const isMobile = window.innerWidth < 768;
    
    if (!asked && isMobile && 'Notification' in window) {
      // Show prompt after 2 seconds
      setTimeout(() => {
        if (Notification.permission === 'default') {
          setOpen(true);
        }
      }, 2000);
    }
  }, []);

  const handleAllow = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onGranted();
      }
    }
    localStorage.setItem('notification-permission-asked', 'true');
    setHasAsked(true);
    setOpen(false);
  };

  const handleLater = () => {
    localStorage.setItem('notification-permission-asked', 'true');
    setHasAsked(true);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Ativar Notificações
          </SheetTitle>
          <SheetDescription className="text-left pt-4">
            Receba alertas instantâneos quando novos leads forem atribuídos a você.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Volume2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-sm">Som de Notificação</h4>
              <p className="text-xs text-muted-foreground">
                Toque suave quando um novo lead chegar
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Vibrate className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-sm">Vibração</h4>
              <p className="text-xs text-muted-foreground">
                Alerta tátil no seu dispositivo
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-sm">Notificações Push</h4>
              <p className="text-xs text-muted-foreground">
                Receba alertas mesmo com o app fechado
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button 
            onClick={handleAllow}
            className="w-full h-12 btn-gradient"
          >
            Permitir Notificações
          </Button>
          <Button 
            onClick={handleLater}
            variant="ghost"
            className="w-full h-12"
          >
            Agora Não
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
