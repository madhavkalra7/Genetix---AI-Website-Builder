import Link from "next/link";
import {CrownIcon} from "lucide-react"
import { formatDuration,intervalToDuration } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
    remainingCredits?: number;
    totalCredits?: number;
}
export const Usage = ({ remainingCredits = 0, totalCredits = 3 }: Props) => {
  const { user } = useAuth();
  const trpc = useTRPC();
  
  // Fetch user's current subscription
  const { data: subscription } = useQuery(
    trpc.subscription.getMySubscription.queryOptions()
  );

  const planName = subscription?.plan?.displayName || "Free";
  const hasProAccess = subscription?.plan?.name === "pro" || subscription?.plan?.name === "enterprise";

    return (
        <div className="rounded-t-xl bg-background border border-b-0 p-2.5">
           <div className="flex items-center gap-x-2">
                <div>
                    <p className="text-sm">
                        {remainingCredits} / {totalCredits} {planName} credits remaining
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {hasProAccess ? "Resets monthly" : "Resets daily"}
                    </p>
                </div>
                {!hasProAccess && (
                    <Button
                        asChild
                        size="sm"
                        variant="tertiary"
                        className="ml-auto"
                    >
                        <Link href="/pricing"><CrownIcon/>Upgrade</Link>
                    </Button>
                )}
           </div>
        </div>
    );
};