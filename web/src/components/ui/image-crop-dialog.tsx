import React, { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, RotateCw } from "lucide-react";

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  cropShape?: "rect" | "round";
  outputSize?: number;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

/**
 * Reusable interactive image cropper. Lets the user pan, zoom and rotate the
 * source image, then returns a JPEG File cropped to the chosen frame.
 */
export function ImageCropDialog({
  open,
  imageSrc,
  aspect = 1,
  cropShape = "round",
  outputSize = 512,
  title = "Ajustar imagem",
  description = "Arraste para enquadrar e use o zoom para aproximar.",
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleClose = () => {
    if (processing) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    onCancel();
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const file = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, outputSize, aspect);
      await onConfirm(file);
      // reset for next open
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[320px] bg-muted rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ZoomIn className="h-4 w-4" />
              Zoom
            </div>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCw className="h-4 w-4" />
              Rotação
            </div>
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={(v) => setRotation(v[0])}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- helpers ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  outputSize: number,
  aspect: number,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const rotRad = (rotation * Math.PI) / 180;

  // Bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotatedSize(
    image.width,
    image.height,
    rotRad,
  );

  // Render the rotated source on an intermediate canvas large enough to fit
  // the rotated bounding box. The image is centered in this canvas.
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = bBoxWidth;
  rotCanvas.height = bBoxHeight;
  const rotCtx = rotCanvas.getContext("2d");
  if (!rotCtx) throw new Error("Canvas 2D context not available");
  rotCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
  rotCtx.rotate(rotRad);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Final output canvas at the requested size / aspect
  const outW = outputSize;
  const outH = Math.round(outputSize / aspect);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context not available");
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";

  // pixelCrop comes in coordinates relative to the rotated bounding box,
  // which is exactly what react-easy-crop returns. Draw that region scaled
  // into the output canvas.
  outCtx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  );

  const blob: Blob = await new Promise((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      0.92,
    ),
  );

  return new File([blob], "cropped.jpg", { type: "image/jpeg" });
}

function rotatedSize(w: number, h: number, rotRad: number) {
  const cos = Math.abs(Math.cos(rotRad));
  const sin = Math.abs(Math.sin(rotRad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
