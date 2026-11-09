"use client";

// One-click regional languages: pick Indian & world languages, then send a full
// build request (1 credit) that adds a language switcher + translations.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LanguagesIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LANGUAGES, buildTranslateRequest, type LanguageCode } from "@/lib/feature-prompts";

interface TranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSent?: () => void;
}

const GROUPS = [
  { region: "india", title: "Indian languages" },
  { region: "world", title: "World languages" },
] as const;

const POPULAR_INDIAN: LanguageCode[] = ["hi", "bn", "ta", "te", "mr"];

export function TranslateDialog({ open, onOpenChange, projectId, onSent }: TranslateDialogProps) {
  const [selected, setSelected] = useState<LanguageCode[]>(["hi"]);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const createMessage = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }));
        queryClient.invalidateQueries(trpc.usage.status.queryOptions());
        toast.success("Translating — rebuilding");
        onOpenChange(false);
        onSent?.();
      },
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "TOO_MANY_REQUESTS" && !usage?.aiquestMode) {
          router.push("/pricing");
        }
      },
    }),
  );

  const toggle = (code: LanguageCode) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const submit = () => {
    if (createMessage.isPending || selected.length === 0) return;
    // Keep the list order stable (Indian languages first) regardless of click order
    const ordered = LANGUAGES.map((l) => l.code).filter((c) => selected.includes(c));
    createMessage.mutate({ projectId, value: buildTranslateRequest(ordered, "en") });
  };

  const pending = createMessage.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LanguagesIcon className="size-5 text-primary" aria-hidden />
            Translate into Indian &amp; world languages
          </DialogTitle>
          <DialogDescription>
            Adds a language switcher, natural translations of all text, the right fonts for each script and right-to-left
            layouts for Urdu &amp; Arabic. Visitors&apos; choice is remembered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {GROUPS.map(({ region, title }) => (
            <fieldset key={region} className="space-y-2">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">{title}</legend>
                {region === "india" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline disabled:opacity-60"
                    disabled={pending}
                    onClick={() => setSelected((prev) => Array.from(new Set([...prev, ...POPULAR_INDIAN])))}
                  >
                    Add top 5
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGES.filter((l) => l.region === region).map((l) => {
                  const checked = selected.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={pending}
                      onClick={() => toggle(l.code)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-60",
                        checked ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                          checked && "border-primary bg-primary text-primary-foreground",
                        )}
                        aria-hidden
                      >
                        {checked && <CheckIcon className="size-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm" dir={l.rtl ? "rtl" : undefined}>
                          {l.nativeName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">{l.name}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.length === 0 ? "Pick at least one language" : `${selected.length} selected`}
          </span>
          <div className="flex gap-2">
            {selected.length > 0 && (
              <Button variant="ghost" onClick={() => setSelected([])} disabled={pending}>
                Clear
              </Button>
            )}
            <Button onClick={submit} disabled={pending || selected.length === 0}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Translate (1 credit)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
