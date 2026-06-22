import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
      setShowReconnected(true);
      
      setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOffline && !showReconnected) return null;

  return (
    <div className="fixed top-14 md:top-4 left-4 right-4 z-50 animate-slide-down">
      {showOffline && (
        <Alert variant="destructive" className="border-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Você está offline. Algumas funcionalidades podem estar limitadas.
          </AlertDescription>
        </Alert>
      )}
      
      {showReconnected && (
        <Alert className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="ml-2 text-green-600 dark:text-green-400">
            Conexão restaurada!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
