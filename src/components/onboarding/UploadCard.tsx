import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, Edit3, Eye, ScanLine, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { OcrQualityResult } from "@/lib/cccd-ocr";
import { ID_IMAGE_TYPE_ERROR, isAllowedIdImageFile } from "@/lib/id-image-upload";
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UploadCardProps = {
  id: string;
  title: string;
  hint: string;
  fileName?: string;
  file?: File | null;
  onFileSelect: (file: File | null) => void;
  onOcr?: () => void | Promise<void>;
  isOcrRunning?: boolean;
  ocrQuality?: OcrQualityResult | null;
  onManualInput?: () => void;
  error?: string;
  required?: boolean;
  className?: string;
  onPreview?: (url: string, label: string) => void;
};

const UploadCard = ({
  id,
  title,
  hint,
  fileName,
  file,
  onFileSelect,
  onOcr,
  isOcrRunning = false,
  ocrQuality,
  onManualInput,
  error,
  required = false,
  className,
  onPreview,
}: UploadCardProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [hovered, setHovered] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeErrorOpen, setTypeErrorOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImageFile = useMemo(() => Boolean(file?.type.startsWith("image/")), [file]);
  const displayError = typeError ?? error;

  useEffect(() => {
    if (!file || !isImageFile) {
      setPreviewUrl("");
      setLightboxOpen(false);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImageFile]);

  const acceptFile = (selectedFile: File | null) => {
    if (!selectedFile) {
      onFileSelect(null);
      return false;
    }
    if (!isAllowedIdImageFile(selectedFile)) {
      setTypeError(ID_IMAGE_TYPE_ERROR);
      setTypeErrorOpen(true);
      toast.error(ID_IMAGE_TYPE_ERROR);
      return false;
    }
    setTypeError(null);
    onFileSelect(selectedFile);
    return true;
  };

  const resetInput = () => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!acceptFile(selectedFile)) resetInput();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (!acceptFile(dropped)) resetInput();
  };

  const handleOcrClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOcrRunning && onOcr) void onOcr();
  };

  const handleRetakeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) {
      input.value = "";
      input.click();
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!previewUrl) return;
    if (onPreview) onPreview(previewUrl, hint);
    else setLightboxOpen(true);
  };

  const isLowQuality = ocrQuality?.isLowQuality ?? false;

  return (
    <div
      className="relative"
      data-testid={`${id}-dropzone`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-8 text-center transition-colors hover:border-primary/40 hover:bg-accent/20 focus-within:ring-2 focus-within:ring-primary/30",
          displayError ? "border-destructive ring-1 ring-destructive/30" : isLowQuality ? "border-warning ring-1 ring-warning/30" : "border-border",
          className,
        )}
      >
        <input
          id={id}
          type="file"
          accept=".png,.jpg,.jpeg"
          className="sr-only pointer-events-none"
          onChange={handleFileChange}
        />
        {previewUrl ? (
          <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            <img
              src={previewUrl}
              alt={fileName ? `Preview of ${fileName}` : "Selected file preview"}
              className="max-h-full w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          <span className="mb-4 rounded-xl bg-primary/10 p-3 text-primary">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hint}
          {required ? <span className="ml-0.5 text-destructive" aria-hidden="true">*</span> : null}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Chỉ chấp nhận file ảnh (JPG, PNG) — tối đa 10MB
        </p>
      </label>

      {displayError ? (
        <p className="mt-1.5 text-xs text-destructive" role="alert">{displayError}</p>
      ) : null}

      {isLowQuality && ocrQuality?.message ? (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <div className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{ocrQuality.message}</p>
              <p className="mt-1 text-warning/80">
                Độ tin cậy: {ocrQuality.confidence}% — Đã đọc {ocrQuality.filledFieldCount}/{ocrQuality.totalExpectedFields} trường
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetakeClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-background px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/10"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Chụp lại
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onManualInput?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-background px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/10"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              Nhập thủ công
            </button>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <button
          type="button"
          onClick={handlePreviewClick}
          aria-label={`Xem ảnh ${hint}`}
          className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-foreground shadow hover:bg-white"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      {onOcr && file && (hovered || isOcrRunning) && !isLowQuality ? (
        <button
          type="button"
          onClick={handleOcrClick}
          disabled={isOcrRunning}
          title="Đọc OCR ảnh này"
          className={cn(
            "absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-md transition-all",
            isOcrRunning
              ? "bg-primary text-primary-foreground opacity-80 cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          <ScanLine className={cn("h-3.5 w-3.5", isOcrRunning && "animate-spin")} aria-hidden="true" />
          {isOcrRunning ? "Đang đọc…" : "OCR"}
        </button>
      ) : null}

      {lightboxOpen && previewUrl && !onPreview ? (
        <DocImageLightbox
          url={previewUrl}
          label={hint}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}

      <AlertDialog open={typeErrorOpen} onOpenChange={setTypeErrorOpen}>
        <AlertDialogContent className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>File không hợp lệ</AlertDialogTitle>
            <AlertDialogDescription>{ID_IMAGE_TYPE_ERROR}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UploadCard;
