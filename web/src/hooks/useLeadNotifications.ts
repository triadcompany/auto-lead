import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/hooks/useSocket';

export function useLeadNotifications() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { on } = useSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/new-lead-notification.wav');
    audioRef.current.volume = 0.7;
    audioRef.current.preload = 'auto';

    const enableAudio = () => {
      if (audioRef.current && !isAudioEnabled) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
          setIsAudioEnabled(true);
        }).catch(() => {
          toast({
            title: "Notificações de áudio",
            description: "Clique em qualquer lugar para ativar as notificações sonoras",
          });
        });
      }
    };

    const handleInteraction = () => {
      enableAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [isAudioEnabled, toast]);

  useEffect(() => {
    if (!profile) return;

    return on('lead:created', (data: any) => {
      if (data?.seller_id !== profile.id && data?.sellerId !== profile.id) return;

      if (audioRef.current && isAudioEnabled) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.warn);
      }

      toast({
        title: '🎯 Novo Lead!',
        description: `${data?.name || 'Um novo lead'} foi atribuído a você.`,
      });
    });
  }, [profile, on, isAudioEnabled, toast]);
}
