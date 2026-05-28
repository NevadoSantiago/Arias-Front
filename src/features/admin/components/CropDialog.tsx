import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

/**
 * Datos del crop devueltos al padre: el área en píxeles más la rotación que
 * el usuario aplicó. Ambos hacen falta para reproducir el resultado en canvas.
 */
export interface CropResult {
  area: Area;
  rotation: number;
}

interface Props {
  /** URL local (object URL o data URL) de la imagen a recortar. */
  imageSrc: string | null;
  open: boolean;
  onClose: () => void;
  onCrop: (result: CropResult) => void;
}

const ROTATION_MIN = -45;
const ROTATION_MAX = 45;

export function CropDialog({ imageSrc, open, onClose, onCrop }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onCrop({ area: croppedAreaPixels, rotation });
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-2xl">Encuadrá el plato</DialogTitle>
          <DialogDescription className="text-sm">
            Arrastrá para mover, scroll/slider para zoom, slider de rotación para
            enderezar. El recorte 4:3 matchea cómo se ve el plato en el menú.
          </DialogDescription>
        </DialogHeader>

        {/* Cropper */}
        <div className="relative w-full h-[400px] bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={4 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              objectFit="contain"
              showGrid
              style={{
                containerStyle: { background: 'hsl(var(--muted))' },
              }}
            />
          )}
        </div>

        {/* Controles ── Zoom + Rotación */}
        <div className="px-6 py-4 border-t border-border space-y-3">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Zoom out" />
            <Slider
              min={1}
              max={4}
              step={0.05}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
              aria-label="Zoom"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Zoom in" />
          </div>

          {/* Rotación */}
          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Girar a la izquierda" />
            <Slider
              min={ROTATION_MIN}
              max={ROTATION_MAX}
              step={0.5}
              value={[rotation]}
              onValueChange={(v) => setRotation(v[0])}
              className="flex-1"
              aria-label="Rotación"
            />
            <RotateCw className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Girar a la derecha" />
            {/* Indicador de valor + reset */}
            <div className="flex items-center gap-1.5 min-w-[80px] justify-end">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {rotation.toFixed(1)}°
              </span>
              {rotation !== 0 && (
                <button
                  type="button"
                  onClick={() => setRotation(0)}
                  className="text-[10px] uppercase tracking-brand text-primary hover:text-primary/80"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!croppedAreaPixels}
            className="uppercase tracking-brand"
          >
            Recortar y subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
