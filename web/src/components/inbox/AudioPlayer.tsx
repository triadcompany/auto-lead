import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  durationMs?: number | null;
  isOutbound?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src, durationMs, isOutbound = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setLoading(false);
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => { setLoading(false); setError(true); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('canplay', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('canplay', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audio.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs opacity-60">
        <span>⚠️ Áudio indisponível</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={togglePlay}
        disabled={loading}
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
          isOutbound
            ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground'
            : 'bg-primary/10 hover:bg-primary/20 text-primary'
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        {/* Progress bar */}
        <div
          className={cn(
            'h-1.5 rounded-full cursor-pointer relative',
            isOutbound ? 'bg-primary-foreground/20' : 'bg-muted'
          )}
          onClick={handleSeek}
        >
          <div
            className={cn(
              'absolute left-0 top-0 h-full rounded-full transition-all',
              isOutbound ? 'bg-primary-foreground/60' : 'bg-primary/60'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time */}
        <div className={cn(
          'text-[10px]',
          isOutbound ? 'text-primary-foreground/50' : 'text-muted-foreground/60'
        )}>
          {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration || 0)}
        </div>
      </div>
    </div>
  );
}
