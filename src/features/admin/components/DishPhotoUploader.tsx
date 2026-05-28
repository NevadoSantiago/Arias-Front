import { useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import PicaModule from 'pica';
// Pica usa CommonJS export que es una factory function, pero @types/pica solo
// declara el namespace. Cast a `any` para llamarla — los métodos del instance
// (resize, toBlob) tienen los tipos correctos por inferencia.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PicaFactory: (opts?: unknown) => { resize: (s: HTMLCanvasElement, t: HTMLCanvasElement, opts: unknown) => Promise<HTMLCanvasElement>; toBlob: (canvas: HTMLCanvasElement, type: string, quality?: number) => Promise<Blob> } = PicaModule as any;
import { Upload, Loader2, X, ImagePlus } from 'lucide-react';
import type { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { presignDishPhotoUpload } from '@/features/admin/services/adminApi';
import { CropDialog, type CropResult } from '@/features/admin/components/CropDialog';

interface Props {
  /** URL actual de la foto (puede ser de R2 o /dishes/legacy.jpg). */
  value: string | null | undefined;
  /** Llamado cuando el upload termina con éxito → nueva URL pública. */
  onChange: (publicUrl: string | null) => void;
  /** Si true, el campo está deshabilitado (form submitting, etc.) */
  disabled?: boolean;
}

const MAX_FILE_MB = 12;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';
// El card del empleado se muestra a ~280-320px. A 2x DPI (retina) son 640px.
// Almacenamos en 800px → mínimo downsampling del browser → moiré mínimo.
// El modal de detalle también se ve bien a 800px (max-w-lg = 512px).
const MAX_DIM = 800;
const OUTPUT_FORMAT = 'image/webp';
const OUTPUT_QUALITY = 0.92;

// Pica instance singleton — features: js+wasm para mejor performance en navegadores modernos
const pica = PicaFactory({ features: ['js', 'wasm'] });

/**
 * Aplica rotación + crop seleccionado y luego resize+encode con Pica.
 *
 * <p>Flujo:
 *   1. Si hay rotación: pintamos la imagen rotada en un canvas "safe area"
 *      (lo suficientemente grande para que la imagen rotada quepa entera).
 *   2. cropArea de react-easy-crop es relativo a la imagen rotada — extraemos
 *      ese rectángulo a un canvas source del tamaño del crop.
 *   3. Pica resize a MAX_DIM (mantiene aspect 4:3).
 *   4. Encode WebP.
 */
async function cropAndCompress(file: File, cropArea: Area, rotation: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // Paso 1: pintamos la imagen rotada en una "safe area" — canvas cuadrado lo
  // suficientemente grande para que ninguna esquina de la imagen rotada quede
  // afuera (lado = diagonal de la imagen).
  const safeArea = Math.max(origW, origH) * Math.SQRT2;
  const rotated = document.createElement('canvas');
  rotated.width = safeArea;
  rotated.height = safeArea;
  const ctx = rotated.getContext('2d')!;
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -origW / 2, -origH / 2);
  bitmap.close();

  // Paso 2: extraer cropArea. react-easy-crop devuelve coords relativas a la
  // imagen rotada centrada en el safe area — sumamos el offset del centrado.
  const offsetX = safeArea / 2 - origW / 2;
  const offsetY = safeArea / 2 - origH / 2;

  const source = document.createElement('canvas');
  source.width = cropArea.width;
  source.height = cropArea.height;
  source.getContext('2d')!.drawImage(
    rotated,
    cropArea.x + offsetX, cropArea.y + offsetY,
    cropArea.width, cropArea.height,
    0, 0, cropArea.width, cropArea.height,
  );

  // Paso 3: Pica resize a MAX_DIM
  const { width, height } = scaleDown(source.width, source.height, MAX_DIM);
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  await pica.resize(source, target, { quality: 3, alpha: true });
  console.log(`[Pica] rot=${rotation}° crop ${cropArea.width}x${cropArea.height} → ${width}x${height}`);

  // Paso 4: encode WebP
  const blob = await pica.toBlob(target, OUTPUT_FORMAT, OUTPUT_QUALITY);
  const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], newName, { type: OUTPUT_FORMAT });
}

function scaleDown(w: number, h: number, maxDim: number): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = maxDim / Math.max(w, h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/**
 * File picker → crop dialog → Pica resize → upload directo a R2.
 *
 * Flow:
 *   1. Usuario selecciona archivo
 *   2. Validamos (tipo, tamaño) y abrimos el cropper
 *   3. Usuario encuadra el plato (4:3) y confirma
 *   4. Aplicamos crop + resize con Pica + encode WebP
 *   5. Pedimos signed URL al backend
 *   6. PUT directo a R2 (NO pasa por nuestro server)
 *   7. Seteamos publicUrl en el form
 */
export function DishPhotoUploader({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  // State del cropper
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  /** Step 1: validar archivo y abrir cropper (sin subir todavía). */
  const handleFileSelect = (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`La imagen no puede pesar más de ${MAX_FILE_MB} MB`);
      return;
    }

    // Cargamos como data URL para el cropper. Usamos object URL — más rápido
    // que FileReader y se revoca al cerrar el dialog.
    const url = URL.createObjectURL(file);
    setOriginalFile(file);
    setCropImageSrc(url);
    setCropOpen(true);
  };

  const closeCropper = () => {
    setCropOpen(false);
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    setOriginalFile(null);
    // Reset el input para permitir re-seleccionar el mismo archivo
    if (inputRef.current) inputRef.current.value = '';
  };

  /** Step 2: el usuario confirmó el crop → procesamos y subimos. */
  const handleCropConfirm = async (result: CropResult) => {
    if (!originalFile) return;
    setCropOpen(false);
    setUploading(true);

    try {
      // Aplicar rotación + crop + resize con Pica
      setProgress('Optimizando…');
      const processed = await cropAndCompress(originalFile, result.area, result.rotation);

      // Presign desde el backend
      setProgress('Preparando upload…');
      const { uploadUrl, publicUrl } = await presignDishPhotoUpload(
        processed.name,
        processed.type,
      );

      // PUT directo a R2
      setProgress('Subiendo a R2…');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: processed,
        headers: { 'Content-Type': processed.type },
      });
      if (!putRes.ok) {
        throw new Error(`R2 devolvió ${putRes.status} — chequeá CORS del bucket`);
      }

      onChange(publicUrl);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setUploading(false);
      // Limpieza del cropper
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      setOriginalFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const hasPhoto = !!value;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        className="sr-only"
        id="dish-photo-upload"
      />

      {/* Card principal: preview o placeholder */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors overflow-hidden',
          uploading ? 'border-primary bg-primary/5' :
            hasPhoto ? 'border-border bg-card' : 'border-border bg-muted/30 hover:border-primary/50'
        )}
      >
        {hasPhoto && !uploading ? (
          <div className="relative aspect-[4/3] bg-muted">
            <img
              src={value!}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Si la URL no carga, mostramos un placeholder
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Quitar foto"
              className="absolute top-2 right-2 h-7 w-7 shadow-md"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="dish-photo-upload"
            className={cn(
              'flex flex-col items-center justify-center aspect-[4/3] gap-2 p-6 text-center',
              !uploading && !disabled && 'cursor-pointer'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs uppercase tracking-brand text-foreground">{progress}</p>
              </>
            ) : (
              <>
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
                <div className="text-xs">
                  <p className="uppercase tracking-brand text-foreground font-medium">
                    Subir foto
                  </p>
                  <p className="text-muted-foreground mt-1">
                    JPG, PNG, WEBP — máx {MAX_FILE_MB} MB
                  </p>
                </div>
              </>
            )}
          </label>
        )}
      </div>

      {/* Acciones secundarias */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Recorte 4:3 + WebP optimizado. Sube directo a Cloudflare R2.
        </p>
        {hasPhoto && !uploading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="uppercase tracking-brand text-[11px]"
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Cambiar
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      {/* Crop dialog — se abre entre file-select y upload */}
      <CropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        onClose={closeCropper}
        onCrop={(result) => void handleCropConfirm(result)}
      />
    </div>
  );
}
