import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (alt || 'image').replace(/[^\w.-]+/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={handleDownload}
          aria-label="Baixar"
        >
          <Download className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <img
        src={src}
        alt={alt || 'Imagem'}
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
