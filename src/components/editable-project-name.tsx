"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ElementType, ReactNode } from "react";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export const PROJECT_NAME_MAX_LENGTH = 60;

export function validateProjectName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Project name cannot be empty";
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    return `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`;
  }
  return null;
}

interface EditableProjectNameProps {
  name: string;
  /** Persist the new (already trimmed and validated) name. Should throw on failure. */
  onSave: (name: string) => Promise<void>;
  /** Element used to render the name when not editing. */
  as?: ElementType;
  /** Classes for the wrapper (flex row). */
  className?: string;
  /** Typography classes for the displayed name; also applied to the input. */
  nameClassName?: string;
  /** Extra classes for the input. */
  inputClassName?: string;
  /** Extra classes for the pencil button. */
  buttonClassName?: string;
  /** Show the pencil only on hover (desktop) — use inside cards with a `group` class. */
  revealOnHover?: boolean;
  iconClassName?: string;
  /** Classes for the wrapper while editing (defaults to `className`). */
  editingClassName?: string;
  /**
   * Custom non-editing render. Receives the truncated name element and the pencil
   * button so callers can place them (e.g. name inside a dropdown trigger, pencil beside it).
   */
  renderDisplay?: (parts: { nameElement: ReactNode; pencil: ReactNode }) => ReactNode;
  /** Content rendered before the input while editing (e.g. a logo). */
  editingPrefix?: ReactNode;
}

const stop = (e: MouseEvent | PointerEvent | KeyboardEvent) => {
  e.stopPropagation();
};

export const EditableProjectName = ({
  name,
  onSave,
  as: NameTag = "span",
  className,
  nameClassName,
  inputClassName,
  buttonClassName,
  revealOnHover = false,
  iconClassName,
  editingClassName,
  renderDisplay,
  editingPrefix,
}: EditableProjectNameProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against blur firing after Enter/Escape already handled the edit.
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setValue(name);
  }, [name, isEditing]);

  useEffect(() => {
    if (isEditing) {
      const input = inputRef.current;
      input?.focus();
      input?.select();
    }
  }, [isEditing]);

  const startEditing = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    finishedRef.current = false;
    setValue(name);
    setError(null);
    setIsEditing(true);
  };

  const cancel = () => {
    finishedRef.current = true;
    setValue(name);
    setError(null);
    setIsEditing(false);
  };

  const commit = async (source: "enter" | "blur") => {
    if (finishedRef.current || isSaving) return;
    const trimmed = value.trim();

    if (trimmed === name.trim()) {
      cancel();
      return;
    }

    const validationError = validateProjectName(trimmed);
    if (validationError) {
      toast.error(validationError);
      if (source === "blur") {
        // Clicking away with an invalid name reverts rather than trapping focus.
        cancel();
      } else {
        setError(validationError);
        inputRef.current?.focus();
      }
      return;
    }

    finishedRef.current = true;
    setIsSaving(true);
    try {
      await onSave(trimmed);
      toast.success("Project renamed");
      setError(null);
      setIsEditing(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Failed to rename project";
      toast.error(message);
      setError(message);
      finishedRef.current = false;
      // Stay in edit mode so the user can retry or press Escape.
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setIsSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      void commit("enter");
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (isEditing) {
    return (
      <div
        className={cn("flex min-w-0 max-w-full items-center gap-1.5", editingClassName ?? className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={stop}
        onKeyDown={stop}
      >
        {editingPrefix}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => void commit("blur")}
          disabled={isSaving}
          maxLength={PROJECT_NAME_MAX_LENGTH + 20}
          aria-label="Project name"
          aria-invalid={!!error}
          title={error ?? undefined}
          className={cn(
            "min-w-0 w-full flex-1 rounded-md border border-white/20 bg-black/40 px-1.5 py-0.5 outline-none",
            "focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 disabled:opacity-60",
            error && "border-red-500/70 focus:border-red-500/70 focus:ring-red-500/40",
            nameClassName,
            inputClassName,
          )}
        />
        {isSaving && (
          <Loader2Icon
            className={cn("size-3.5 shrink-0 animate-spin text-muted-foreground", iconClassName)}
            aria-label="Saving"
          />
        )}
      </div>
    );
  }

  const nameElement = (
    <NameTag className={cn("min-w-0 truncate", nameClassName)} title={name}>
      {name}
    </NameTag>
  );

  const pencil = (
    <button
      type="button"
      aria-label="Rename project"
      title="Rename project"
      onClick={startEditing}
      onPointerDown={stop}
      onKeyDown={stop}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-opacity",
        "hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500/60",
        revealOnHover && "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        buttonClassName,
      )}
    >
      <PencilIcon className={cn("size-3.5", iconClassName)} />
    </button>
  );

  return (
    <div className={cn("flex min-w-0 max-w-full items-center gap-1.5", className)}>
      {renderDisplay ? renderDisplay({ nameElement, pencil }) : (
        <>
          {nameElement}
          {pencil}
        </>
      )}
    </div>
  );
};
