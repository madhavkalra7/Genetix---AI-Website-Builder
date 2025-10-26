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
import { useQuery } from "@tanstack/react-query";

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

    setLoading(plan.name);

    try {
      // Get PhonePe payment link from environment
      let phonePeLink = "";
      if (plan.name === "pro") {
        phonePeLink = process.env.NEXT_PUBLIC_PHONEPE_PRO_LINK || "";
      } else if (plan.name === "enterprise") {
        phonePeLink = process.env.NEXT_PUBLIC_PHONEPE_ENTERPRISE_LINK || "";
      }

      if (!phonePeLink) {
        toast.error("Payment link not configured");
        setLoading(null);
        return;
      }

      // Create payment record in database
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName: plan.name,
          amount: plan.priceValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      // Store order ID in localStorage for later verification
      if (data.order_id) {
        localStorage.setItem("pending_order_id", data.order_id);
        localStorage.setItem("pending_plan_name", plan.name);
      }

      // Redirect to PhonePe payment page
      toast.success("Redirecting to PhonePe...", {
        description: "After payment, you'll be redirected back automatically",
      });
      
      // Open payment success page in a new tab for user to return after payment
      window.open(`${window.location.origin}/payment-success`, "_blank");
      
      // Redirect to PhonePe
      setTimeout(() => {
        window.location.href = phonePeLink;
      }, 2000);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
    } finally {
      setLoading(null);
    }
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
    </div>
  );
}