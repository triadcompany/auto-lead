import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioRecorderProps {
  organizationId: string;
  conversationId: string;
  onAudioSent: () => void;
  disabled?: boolean;
}

export function AudioRecorder({ organizationId, conversationId, onAudioSent, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(100);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      console.error('Mic access error:', err);
      toast.error('Não foi possível acessar o microfone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
  }, [stopRecording, audioUrl]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob) return;
    setSending(true);

    try {
      // Convert blob to base64 and send everything to the edge function
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const res = await supabase.functions.invoke('whatsapp-send-audio', {
        body: {
          organization_id: organizationId,
          conversation_id: conversationId,
          audio_base64: base64,
          mime_type: 'audio/webm',
        },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);

      toast.success('Áudio enviado');
      onAudioSent();
      cancelRecording();
    } catch (err: any) {
      console.error('Send audio error:', err);
      toast.error(err.message || 'Erro ao enviar áudio');
    } finally {
      setSending(false);
    }
  }, [audioBlob, organizationId, conversationId, onAudioSent, cancelRecording]);

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Recording state - show recording UI
  if (recording) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">{formatElapsed(elapsed)}</span>
          <span className="text-xs text-muted-foreground">Gravando...</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 text-muted-foreground"
          onClick={cancelRecording}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-destructive hover:bg-destructive/90"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Preview state - show recorded audio
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <audio src={audioUrl} controls className="flex-1 h-8" style={{ maxHeight: '32px' }} />
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 text-muted-foreground"
          onClick={cancelRecording}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={sendAudio}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  // Default - just the mic button
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-primary"
      onClick={startRecording}
      disabled={disabled}
      title="Gravar áudio"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
