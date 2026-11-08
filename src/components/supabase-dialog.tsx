"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, DatabaseIcon, Loader2Icon, PlugZapIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { validateSupabaseAnonKey, validateSupabaseUrl } from "@/modules/integrations/shared";

interface SupabaseDialogProps {
    projectId: string;
    className?: string;
}

export function SupabaseDialog({ projectId, className }: SupabaseDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("");
    const [anonKey, setAnonKey] = useState("");
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

    const statusQuery = useQuery({
        ...trpc.integrations.getSupabase.queryOptions({ projectId }),
        enabled: open,
    });
    const status = statusQuery.data;
    const connected = !!status?.connected;

    useEffect(() => {
        if (!open) return;
        setUrl(status?.url ?? "");
        setAnonKey("");
        setTestResult(null);
    }, [open, status?.url]);

    const invalidate = () =>
        queryClient.invalidateQueries(trpc.integrations.getSupabase.queryFilter({ projectId }));

    const save = useMutation(
        trpc.integrations.setSupabase.mutationOptions({
            onSuccess: async () => {
                await invalidate();
                setAnonKey("");
                toast.success("Supabase connected", {
                    description: "Ask the AI to add sign-up, login or a database to your app.",
                });
            },
            onError: (error) => toast.error(error.message || "Could not save the connection"),
        })
    );

    const disconnect = useMutation(
        trpc.integrations.disconnectSupabase.mutationOptions({
            onSuccess: async () => {
                await invalidate();
                setUrl("");
                setAnonKey("");
                setTestResult(null);
                toast.success("Supabase disconnected");
            },
            onError: (error) => toast.error(error.message || "Could not disconnect"),
        })
    );

    const test = useMutation(
        trpc.integrations.testSupabase.mutationOptions({
            onSuccess: (result) => {
                setTestResult(result);
                if (result.ok) toast.success(result.message);
                else toast.error(result.message);
            },
            onError: (error) => {
                setTestResult({ ok: false, message: error.message });
                toast.error(error.message || "Connection test failed");
            },
        })
    );

    const busy = save.isPending || disconnect.isPending || test.isPending;

    const validate = (): boolean => {
        const u = validateSupabaseUrl(url);
        if (!u.ok) {
            toast.error(u.error);
            return false;
        }
        const k = validateSupabaseAnonKey(anonKey);
        if (!k.ok) {
            toast.error(k.error);
            return false;
        }
        return true;
    };

    const urlCheck = url.trim() ? validateSupabaseUrl(url) : null;
    const urlError = urlCheck && !urlCheck.ok ? urlCheck.error : null;
    const keyCheck = anonKey.trim() ? validateSupabaseAnonKey(anonKey) : null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("shrink-0", className)}
                    aria-label="Backend (Supabase)"
                    title="Backend (Supabase)"
                >
                    <DatabaseIcon />
                    <span className="hidden sm:inline">Backend</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Connect Supabase</DialogTitle>
                    <DialogDescription>
                        Connect your Supabase project to let the AI add real sign-up/login and a database.
                        Use the <strong>anon public</strong> key (never the service_role key). The AI will
                        also write a <code>schema.sql</code> you run in the Supabase SQL editor.
                    </DialogDescription>
                </DialogHeader>

                {statusQuery.isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                    </div>
                ) : statusQuery.isError ? (
                    <p className="text-sm text-destructive">
                        {statusQuery.error.message || "Could not load the connection status."}
                    </p>
                ) : (
                    <div className="grid gap-4 min-w-0">
                        {connected && (
                            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm min-w-0">
                                <CheckCircle2Icon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                                <div className="min-w-0">
                                    <p className="font-medium">Connected</p>
                                    <p className="truncate text-muted-foreground" title={status?.url ?? ""}>
                                        {status?.url}
                                    </p>
                                    <p className="text-muted-foreground">Key: {status?.anonKeyPreview}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-1.5">
                            <Label htmlFor="supabase-url">Project URL</Label>
                            <Input
                                id="supabase-url"
                                value={url}
                                onChange={(e) => {
                                    setUrl(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder="https://abcdefgh.supabase.co"
                                autoComplete="off"
                                spellCheck={false}
                                inputMode="url"
                                disabled={busy}
                                aria-invalid={!!urlError}
                            />
                            {urlError && (
                                <p className="text-xs text-destructive">{urlError}</p>
                            )}
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="supabase-key">Anon public key</Label>
                            <Input
                                id="supabase-key"
                                value={anonKey}
                                onChange={(e) => {
                                    setAnonKey(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder={connected ? "Paste a key to replace the saved one" : "eyJhbGciOi..."}
                                autoComplete="off"
                                spellCheck={false}
                                disabled={busy}
                                aria-invalid={!!keyCheck && !keyCheck.ok}
                            />
                            <p
                                className={cn(
                                    "text-xs",
                                    keyCheck && !keyCheck.ok ? "text-destructive" : "text-muted-foreground"
                                )}
                            >
                                {keyCheck && !keyCheck.ok
                                    ? keyCheck.error
                                    : "Supabase dashboard → Project Settings → API → anon public key."}
                            </p>
                        </div>

                        {testResult && (
                            <p className={cn("text-sm", testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                                {testResult.message}
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                    {connected && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-destructive hover:text-destructive sm:mr-auto"
                            onClick={() => disconnect.mutate({ projectId })}
                            disabled={busy}
                        >
                            {disconnect.isPending && <Loader2Icon className="animate-spin" />}
                            Disconnect
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            if (validate()) test.mutate({ url, anonKey });
                        }}
                        disabled={busy || statusQuery.isLoading}
                    >
                        {test.isPending ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
                        Test
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            if (validate()) save.mutate({ projectId, url, anonKey });
                        }}
                        disabled={busy || statusQuery.isLoading}
                    >
                        {save.isPending && <Loader2Icon className="animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
