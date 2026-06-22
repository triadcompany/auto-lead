import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const NEW_LEAD_AUDIO_PATH = "/sounds/new-lead-notification.wav";
const THROTTLE_MS = 3000;

export function useNewLeadNotification(userId?: string) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const lastPlayTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setNotificationsGranted(Notification.permission === 'granted');
    }

    // Load user preferences from localStorage
    const savedAudioPref = localStorage.getItem('notifications:audio');
    const savedVibrationPref = localStorage.getItem('notifications:vibration');
    
    if (savedAudioPref !== null) setAudioEnabled(savedAudioPref === 'true');
    if (savedVibrationPref !== null) setVibrationEnabled(savedVibrationPref === 'true');

    // Preload audio
    audioRef.current = new Audio(NEW_LEAD_AUDIO_PATH);
    audioRef.current.preload = 'auto';

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNewLeadSound = () => {
    if (!audioEnabled) return;

    const now = Date.now();
    if (now - lastPlayTimeRef.current < THROTTLE_MS) return;

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log('Audio play prevented:', err);
      });
      lastPlayTimeRef.current = now;
    }
  };

  const vibrate = () => {
    if (!vibrationEnabled) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Seu navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') {
      setNotificationsGranted(true);
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setNotificationsGranted(granted);
      return granted;
    }

    return false;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (!notificationsGranted) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/autolead-logo.png',
        badge: '/autolead-logo.png',
        ...options,
      });
    }
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('new-lead-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `seller_id=eq.${userId}`,
        },
        (payload) => {
          const lead = payload.new as any;
          
          playNewLeadSound();
          vibrate();

          toast.success(`Novo lead atribuído!`, {
            description: `${lead.name} - ${lead.source || 'origem desconhecida'}`,
            duration: 5000,
          });

          showNotification('Novo Lead Atribuído', {
            body: `${lead.name} - ${lead.source || 'origem desconhecida'}`,
            tag: 'new-lead',
            requireInteraction: false,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, audioEnabled, vibrationEnabled, notificationsGranted]);

  const updatePreferences = (audio: boolean, vibration: boolean) => {
    setAudioEnabled(audio);
    setVibrationEnabled(vibration);
    localStorage.setItem('notifications:audio', String(audio));
    localStorage.setItem('notifications:vibration', String(vibration));
  };

  return {
    audioEnabled,
    vibrationEnabled,
    notificationsGranted,
    playNewLeadSound,
    requestNotificationPermission,
    updatePreferences,
  };
}
