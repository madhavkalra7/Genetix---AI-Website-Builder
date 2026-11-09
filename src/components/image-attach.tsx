"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/image-lightbox";

export const IMAGE_ATTACH_HINT = "Attach a screenshot, sketch or design — Genetix will build from it";
export const MAX_IMAGES = 3;
// Sized so 3 images stay under Vercel's 4.5MB request-body limit (base64 adds ~33%)
const MAX_EDGE_PX = 1440;
const JPEG_QUALITY = 0.82;
const MAX_IMAGE_BYTES = 900 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export type AttachedImage = { id: string; dataUrl: string; name: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

/** Downscales to MAX_EDGE_PX on the long edge and re-encodes as JPEG. Returns a data URL. */
async function downscaleToJpeg(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, MAX_EDGE_PX / longEdge);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    // JPEG has no alpha: paint transparent areas white (sketches/screenshots with transparency)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

/**
 * State + handlers for attaching reference images (button, paste, drag-and-drop).
 * Images are downscaled client-side before being kept in state as JPEG data URLs.
 */
export function useImageAttachments(opts: { max?: number; disabled?: boolean } = {}) {
  const max = opts.max ?? MAX_IMAGES;
  const disabled = !!opts.disabled;
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Slots claimed synchronously so rapid adds can't exceed the max
  const claimedRef = useRef(0);
  const dragDepthRef = useRef(0);
  const imagesRef = useRef<AttachedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const addFiles = useCallback(
    async (input: FileList | File[] | null | undefined) => {
      if (disabled) return;
      const files = imageFilesFrom(input);
      if (files.length === 0) return;
      const supported = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
      if (supported.length < files.length) {
        toast.error("Only PNG, JPG or WebP images are supported.");
      }
      const free = max - claimedRef.current;
      if (free <= 0) {
        toast.error(`You can attach up to ${max} images.`);
        return;
      }
      if (supported.length > free) {
        toast.error(`You can attach up to ${max} images — only the first ${free} were added.`);
      }
      const batch = supported.slice(0, free);
      claimedRef.current += batch.length;
      setProcessingCount((c) => c + batch.length);

      await Promise.all(
        batch.map(async (file) => {
          let added = false;
          try {
            const dataUrl = await downscaleToJpeg(file);
            if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
              toast.error(`"${file.name || "Image"}" is too large even after compression (max 900KB) — try a smaller or cropped image.`);
              return;
            }
            const id = typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setImages((prev) => [...prev, { id, dataUrl, name: file.name || "Pasted image" }]);
            added = true;
          } catch {
            toast.error(`Couldn't read "${file.name || "image"}".`);
          } finally {
            if (!added) claimedRef.current -= 1;
            setProcessingCount((c) => c - 1);
          }
        }),
      );
    },
    [disabled, max],
  );

  const remove = useCallback((id: string) => {
    if (!imagesRef.current.some((img) => img.id === id)) return;
    claimedRef.current = Math.max(0, claimedRef.current - 1);
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const clear = useCallback(() => {
    claimedRef.current = Math.max(0, claimedRef.current - imagesRef.current.length);
    setImages([]);
  }, []);

  /** Attach to a textarea/input: pasted image files become attachments; text paste is untouched. */
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = imageFilesFrom(e.clipboardData?.files);
      if (files.length === 0) return;
      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
      void addFiles(files);
    },
    [addFiles],
  );

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  /** Spread onto the drop zone element. */
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e) || disabled) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e) || disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      if (!disabled) void addFiles(e.dataTransfer.files);
    },
  };

  return {
    images,
    dataUrls: images.map((img) => img.dataUrl),
    isProcessing: processingCount > 0,
    isDragging,
    canAddMore: images.length + processingCount < max,
    addFiles,
    remove,
    clear,
    onPaste,
    dropHandlers,
  };
}

interface ImageAttachButtonProps {
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
  label?: string;
}

/** Icon button that opens the file picker (PNG/JPG/WebP, multiple). */
export function ImageAttachButton({ onFiles, disabled, className, iconClassName, label = "Attach images" }: ImageAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={IMAGE_ATTACH_HINT}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex items-center justify-center rounded-full p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
          className,
        )}
      >
        <ImagePlusIcon className={cn("size-5", iconClassName)} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </>
  );
}

interface ImageAttachThumbnailsProps {
  images: AttachedImage[];
  onRemove: (id: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Removable thumbnails of the attached images (renders nothing when empty). Click one to preview it. */
export function ImageAttachThumbnails({ images, onRemove, isProcessing, disabled, className }: ImageAttachThumbnailsProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // Close the preview if its images were removed (e.g. the form was submitted and cleared)
  useEffect(() => {
    if (previewIndex !== null && previewIndex >= images.length) {
      setPreviewIndex(images.length > 0 ? images.length - 1 : null);
    }
  }, [images.length, previewIndex]);

  if (images.length === 0 && !isProcessing) return null;
  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Attached images">
        {images.map((img, i) => (
          <li key={img.id} className="group/thumb relative size-16 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-black/30 transition-colors hover:border-purple-400/60">
            <button
              type="button"
              aria-label={`Preview attached image ${i + 1}: ${img.name}`}
              title="Click to preview"
              onClick={() => setPreviewIndex(i)}
              className="block size-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img
                src={img.dataUrl}
                alt={`Attached image ${i + 1}: ${img.name}`}
                className="size-full object-cover transition-transform duration-200 group-hover/thumb:scale-105"
              />
            </button>
            <button
              type="button"
              aria-label={`Remove attached image ${i + 1}`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(img.id);
              }}
              className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/75 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </li>
        ))}
        {isProcessing && (
          <li className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/25" aria-live="polite">
            <Loader2Icon className="size-4 animate-spin opacity-70" aria-label="Processing image" />
          </li>
        )}
      </ul>
      {previewIndex !== null && images.length > 0 && (
        <ImageLightbox
          images={images.map((img) => ({ src: img.dataUrl, name: img.name }))}
          index={Math.min(previewIndex, images.length - 1)}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}

/** Overlay shown inside a `relative` drop zone while files are dragged over it. */
export function ImageDropOverlay({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-purple-400 bg-purple-500/15 text-sm font-medium text-white backdrop-blur-[1px]",
        className,
      )}
    >
      Drop images to attach
    </div>
  );
}
