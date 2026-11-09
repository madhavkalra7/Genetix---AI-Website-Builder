"use client";

// Full-screen image viewer (dark overlay, Escape / click-outside to close, arrow keys to navigate).
// Reusable: attachment thumbnails in the chat input use it, and chat message bubbles can too.

import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightboxImage = { src: string; name?: string };

interface ImageLightboxProps {
  images: LightboxImage[];
  /** Index of the image to show first. */
  index: number;
  onClose: () => void;
}

/** Approximate byte size of a base64 data URL (null for regular URLs). */
function dataUrlSize(src: string): string | null {
  if (!src.startsWith("data:")) return null;
  const comma = src.indexOf(",");
  if (comma < 0 || !src.slice(0, comma).includes(";base64")) return null;
  const bytes = Math.floor(((src.length - comma - 1) * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const navButton =
  "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition-all hover:border-purple-400/60 hover:bg-black/80 hover:shadow-[0_0_18px_rgba(168,85,247,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

export function ImageLightbox({ images, index, onClose }: ImageLightboxProps) {
  const count = images.length;
  const [current, setCurrent] = useState(() => Math.min(Math.max(index, 0), Math.max(count - 1, 0)));

  useEffect(() => {
    setCurrent(Math.min(Math.max(index, 0), Math.max(count - 1, 0)));
  }, [index, count]);

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setCurrent((i) => (i + delta + count) % count);
    },
    [count],
  );

  const image = images[current];
  if (!image) return null;
  const size = dataUrlSize(image.src);
  const multiple = count > 1;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 p-4 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          // Click on the empty area around the image closes (the Content covers the overlay)
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              go(1);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {image.name || "Image preview"}
            {multiple ? ` (${current + 1} of ${count})` : ""}
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            aria-label="Close preview"
            className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition-all hover:border-purple-400/60 hover:bg-black/80 hover:shadow-[0_0_18px_rgba(168,85,247,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <XIcon className="size-5" aria-hidden />
          </DialogPrimitive.Close>

          {multiple && (
            <>
              <button type="button" aria-label="Previous image" onClick={() => go(-1)} className={cn(navButton, "left-3 sm:left-6")}>
                <ChevronLeftIcon className="size-6" aria-hidden />
              </button>
              <button type="button" aria-label="Next image" onClick={() => go(1)} className={cn(navButton, "right-3 sm:right-6")}>
                <ChevronRightIcon className="size-6" aria-hidden />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary/data URLs, no optimisation needed */}
          <img
            key={image.src}
            src={image.src}
            alt={image.name || `Image ${current + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-xl border border-white/10 object-contain shadow-2xl shadow-black/70"
          />

          {(image.name || size || multiple) && (
            <div className="flex max-w-[90vw] items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-white/75 backdrop-blur-md">
              {image.name && <span className="truncate font-medium text-white">{image.name}</span>}
              {size && <span className="shrink-0 text-white/50">{size}</span>}
              {multiple && (
                <span className="shrink-0 text-white/50">
                  {current + 1} / {count}
                </span>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
