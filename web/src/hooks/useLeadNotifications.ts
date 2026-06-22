import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useLeadNotifications() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/new-lead-notification.wav');
    audioRef.current.volume = 0.7;
    audioRef.current.preload = 'auto';

    // Request audio permission on first user interaction
    const enableAudio = () => {
      if (audioRef.current && !isAudioEnabled) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
          setIsAudioEnabled(true);
          console.log('🔊 Audio notifications enabled');
        }).catch((error) => {
          console.warn('❌ Audio autoplay blocked:', error);
          toast({
            title: "Notificações de áudio",
            description: "Clique em qualquer lugar para ativar as notificações sonoras",
            variant: "default",
          });
        });
      }
    };

    // Enable audio on first user interaction
    const handleUserInteraction = () => {
      enableAudio();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [isAudioEnabled, toast]);

  // Setup realtime subscription for new leads
  useEffect(() => {
    if (!profile) return;

    console.log('🔔 Setting up lead notifications for profile:', profile.id);

    const channel = supabase
      .channel('new-leads-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          console.log('📢 New lead detected:', payload);
          
          const newLead = payload.new as any;
          
          // Only notify if this lead is assigned to the current user
          if (newLead.seller_id === profile.id) {
            console.log('🎯 Lead assigned to current user, showing notification');
            
            // Play notification sound
            if (audioRef.current && isAudioEnabled) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch((error) => {
                console.warn('❌ Error playing notification sound:', error);
              });
            }

            // Show toast notification
            toast({
              title: "🎉 Novo Lead Recebido!",
              description: `${newLead.name} - ${newLead.phone}`,
              duration: 5000,
            });

            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              new Notification('Novo Lead Recebido!', {
                body: `${newLead.name} - ${newLead.phone}`,
                icon: '/favicon.ico',
                tag: 'new-lead',
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from lead notifications');
      supabase.removeChannel(channel);
    };
  }, [profile, toast, isAudioEnabled]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('🔔 Notification permission:', permission);
      return permission === 'granted';
    }
    return false;
  };

  // Test notification (for debugging)
  const testNotification = () => {
    if (audioRef.current && isAudioEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
    
    toast({
      title: "🧪 Teste de Notificação",
      description: "Esta é uma notificação de teste",
      duration: 3000,
    });
  };

  return {
    isAudioEnabled,
    requestNotificationPermission,
    testNotification,
  };
}