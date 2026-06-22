import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Volume2, Vibrate, BellRing, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNewLeadNotification } from "@/hooks/useNewLeadNotification";
import { toast } from "sonner";

const NEW_LEAD_AUDIO_PATH = "/sounds/new-lead-notification.wav";

export function NotificationSettings() {
  const { profile } = useAuth();
  const {
    audioEnabled,
    vibrationEnabled,
    notificationsGranted,
    requestNotificationPermission,
    updatePreferences,
  } = useNewLeadNotification(profile?.id);

  const [localAudio, setLocalAudio] = useState(audioEnabled);
  const [localVibration, setLocalVibration] = useState(vibrationEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLocalAudio(audioEnabled);
    setLocalVibration(vibrationEnabled);
  }, [audioEnabled, vibrationEnabled]);

  useEffect(() => {
    audioRef.current = new Audio(NEW_LEAD_AUDIO_PATH);
    audioRef.current.preload = "auto";
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleAudioToggle = (checked: boolean) => {
    setLocalAudio(checked);
    updatePreferences(checked, localVibration);
    if (checked) {
      // Test sound to unlock browser autoplay policy
      audioRef.current?.play().catch(() => {});
    }
  };

  const handleVibrationToggle = (checked: boolean) => {
    setLocalVibration(checked);
    updatePreferences(localAudio, checked);
    if (checked && "vibrate" in navigator) {
      navigator.vibrate(150);
    }
  };

  const handleTestSound = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current
      .play()
      .then(() => {
        toast.success("Som de notificação reproduzido");
      })
      .catch(() => {
        toast.error("Não foi possível reproduzir o som. Verifique as permissões do navegador.");
      });
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast.success("Notificações do navegador ativadas");
      // Show a sample notification
      new Notification("AutoLead", {
        body: "Você receberá notificações quando novos leads chegarem.",
        icon: "/autolead-logo.png",
      });
    } else {
      toast.error("Permissão de notificação negada. Habilite manualmente nas configurações do navegador.");
    }
  };

  return (
    <Card className="card-gradient border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-poppins">
          <Bell className="h-5 w-5 text-primary" />
          Notificações
        </CardTitle>
        <CardDescription className="font-poppins">
          Configure como você quer ser avisado quando novos leads chegarem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Som */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 p-4">
          <div className="flex items-start gap-3 flex-1">
            <Volume2 className="h-5 w-5 text-primary mt-1" />
            <div className="space-y-1">
              <Label htmlFor="audio-toggle" className="text-base font-medium font-poppins cursor-pointer">
                Som de novo lead
              </Label>
              <p className="text-sm text-muted-foreground font-poppins">
                Tocar um alerta sonoro sempre que um novo lead for atribuído a você.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestSound}
              className="font-poppins"
            >
              <Play className="h-4 w-4 mr-1" />
              Testar
            </Button>
            <Switch
              id="audio-toggle"
              checked={localAudio}
              onCheckedChange={handleAudioToggle}
            />
          </div>
        </div>

        {/* Vibração */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 p-4">
          <div className="flex items-start gap-3 flex-1">
            <Vibrate className="h-5 w-5 text-primary mt-1" />
            <div className="space-y-1">
              <Label htmlFor="vibration-toggle" className="text-base font-medium font-poppins cursor-pointer">
                Vibração (mobile)
              </Label>
              <p className="text-sm text-muted-foreground font-poppins">
                Vibrar o dispositivo ao receber um novo lead. Funciona apenas em celulares e tablets.
              </p>
            </div>
          </div>
          <Switch
            id="vibration-toggle"
            checked={localVibration}
            onCheckedChange={handleVibrationToggle}
          />
        </div>

        {/* Notificações do navegador */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 p-4">
          <div className="flex items-start gap-3 flex-1">
            <BellRing className="h-5 w-5 text-primary mt-1" />
            <div className="space-y-1">
              <Label className="text-base font-medium font-poppins">
                Notificações do navegador
              </Label>
              <p className="text-sm text-muted-foreground font-poppins">
                {notificationsGranted
                  ? "Ativadas. Você receberá notificações mesmo com a aba em segundo plano."
                  : "Permita notificações para receber alertas mesmo com o sistema em segundo plano."}
              </p>
            </div>
          </div>
          {notificationsGranted ? (
            <span className="text-sm font-medium text-primary font-poppins whitespace-nowrap">
              Ativadas
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestPermission}
              className="font-poppins whitespace-nowrap"
            >
              Permitir
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground font-poppins pt-2">
          As preferências são salvas neste navegador. Se acessar de outro dispositivo, ajuste novamente.
        </p>
      </CardContent>
    </Card>
  );
}
