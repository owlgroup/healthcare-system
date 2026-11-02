import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DocImageLightboxProps = {
  url: string;
  label: string;
  onClose: () => void;
};

const DocImageLightbox = ({ url, label, onClose }: DocImageLightboxProps) =>
  createPortal(
    <div
      data-image-lightbox
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh ${label}`}
      onPointerDown={e => e.stopPropagation()}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Đóng xem ảnh"
        className="pointer-events-auto absolute right-4 top-4 rounded-md bg-white/90 p-2 text-foreground shadow hover:bg-white"
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <img
        src={url}
        alt={`Xem trước ${label}`}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body,
  );

export default DocImageLightbox;
