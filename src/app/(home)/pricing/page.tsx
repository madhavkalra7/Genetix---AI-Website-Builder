"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const plans = [
  {
    name: "free",
    displayName: "Free",
    price: "Rs 0",
    priceValue: 0,
    interval: "forever",
    credits: 3,
    features: [
      "3 AI credits daily",
      "5 projects",
      "Basic templates",
      "Community support",
    ],
    popular: false,
  },
  {
    name: "pro",
    displayName: "Pro",
    price: "Rs 99",
    priceValue: 99,
    interval: "per month",
    credits: 100,
    features: [
      "100 AI credits per month",
      "Unlimited projects",
      "All templates",
      "Priority support",
      "Advanced features",
    ],
    popular: true,
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    price: "Rs 699",
    priceValue: 699,
    interval: "per month",
    credits: 1000,
    features: [
      "1,000 AI credits per month",
      "Unlimited projects",
      "Custom templates",
      "24/7 Dedicated support",
      "Team collaboration",
      "API access",
    ],
    popular: false,
  },
];

export default function Page() {
  const { user } = useAuth();
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState<string>("free");
  const trpc = useTRPC();
  
  // Fetch user's current subscription
  const { data: subscription } = useQuery(
    trpc.subscription.getMySubscription.queryOptions()
  );

  useEffect(() => {
    if (subscription?.plan?.name) {
      setCurrentPlanName(subscription.plan.name);
    }
  }, [subscription]);

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [requestEmail, setRequestEmail] = useState("");

  const requestMutation = useMutation(
    trpc.subscription.requestCredits.mutationOptions({
      onSuccess: () => {
        toast.success("Request sent successfully!", {
          description: "Your credits will be activated shortly by the administrator."
        });
        setIsRequestOpen(false);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to submit credit request");
      }
    })
  );

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestEmail || !selectedPlan) {
      toast.error("Please enter a valid email address");
      return;
    }
    requestMutation.mutate({
      email: requestEmail,
      planName: selectedPlan.displayName
    });
  };

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (!user && !session?.user) {
      toast.error("Please sign in to subscribe");
      router.push("/sign-in");
      return;
    }

    if (plan.name === "free") {
      toast.info("You're already on the Free plan!");
      return;
    }

    setSelectedPlan(plan);
    setRequestEmail(user?.email || session?.user?.email || "");
    setIsRequestOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Genetix"
            width={60}
            height={60}
            className="rounded-lg"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg">
          Start building amazing websites with AI-powered tools
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = plan.name === currentPlanName;
          
          return (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular
                  ? "border-primary shadow-lg scale-105"
                  : isCurrentPlan
                  ? "border-green-500 shadow-md"
                  : "border-border"
              }`}
            >
              {plan.popular && !isCurrentPlan && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Current Plan
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
              <CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {plan.interval}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  {plan.credits} AI credits {plan.interval !== "forever" && "per month"}
                </div>
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={isCurrentPlan ? "secondary" : plan.popular ? "default" : "outline"}
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.name || isCurrentPlan}
              >
                {loading === plan.name
                  ? "Processing..."
                  : isCurrentPlan
                  ? "Active Plan"
                  : "Subscribe Now"}
              </Button>
            </CardFooter>
          </Card>
        );
        })}
      </div>

      {/* Request Credits Popup Modal */}
      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogContent className="bg-neutral-950 border border-white/10 rounded-3xl text-white font-sans p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-[Orbitron] text-purple-400">
              Request Credits Activation
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50 font-sans">
              Enter your email to request activation for the <span className="font-bold text-white font-[Orbitron]">{selectedPlan?.displayName}</span> plan. The administrator will be notified.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRequest} className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Your Email Address</label>
              <input
                type="email"
                required
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="Enter your email..."
                className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
              />
            </div>

            <DialogFooter className="pt-4 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRequestOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-white rounded-xl h-10 font-[Orbitron] text-xs cursor-pointer flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={requestMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 font-bold font-[Orbitron] text-xs cursor-pointer flex-1 flex items-center justify-center gap-1.5"
              >
                {requestMutation.isPending ? (
                  <span className="animate-spin mr-1">🔄</span>
                ) : null}
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}