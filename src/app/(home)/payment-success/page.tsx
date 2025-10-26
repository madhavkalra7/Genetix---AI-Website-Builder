"use client"
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"pending" | "success" | "failed" | "activating">("pending");
    const [credits, setCredits] = useState<number | null>(null);
    const orderId = searchParams.get("order_id");
    const paymentStatus = searchParams.get("status");

    useEffect(() => {
        const activateSubscription = async () => {
            let finalOrderId = orderId;
            let finalStatus = paymentStatus;

            // If no URL params, check localStorage
            if (!finalOrderId && !finalStatus) {
                const storedOrderId = localStorage.getItem("pending_order_id");
                const storedPlanName = localStorage.getItem("pending_plan_name");
                
                if (storedOrderId) {
                    finalOrderId = storedOrderId;
                    finalStatus = "success"; // Assume success if coming from PhonePe
                    
                    // Update URL with params
                    window.history.replaceState(
                        null,
                        "",
                        `/payment-success?order_id=${storedOrderId}&status=success`
                    );
                    
                    // Clear localStorage
                    localStorage.removeItem("pending_order_id");
                    localStorage.removeItem("pending_plan_name");
                }
            }

            // Check payment status from URL params
            if (finalStatus === "success" && finalOrderId) {
                setStatus("activating");
                
                try {
                    // Call activation API
                    const response = await fetch("/api/payment/activate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            transactionId: finalOrderId,
                        }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                        setStatus("success");
                        setCredits(data.credits);
                        toast.success(`Subscription activated! ${data.credits} credits added to your account.`);
                        
                        // Redirect to home page after 3 seconds
                        setTimeout(() => {
                            router.push("/");
                        }, 3000);
                    } else {
                        throw new Error(data.error);
                    }
                } catch (error: any) {
                    console.error("Activation error:", error);
                    setStatus("pending");
                    toast.error("Activation will be processed manually within 24 hours");
                }
            } else if (finalStatus === "failed") {
                setStatus("failed");
            } else {
                setStatus("pending");
            }
        };

        activateSubscription();
    }, [paymentStatus, orderId, router]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    {status === "activating" && (
                        <>
                            <div className="mx-auto mb-4">
                                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                            </div>
                            <CardTitle className="text-2xl">Activating Subscription...</CardTitle>
                            <CardDescription>
                                Please wait while we set up your account
                            </CardDescription>
                        </>
                    )}
                    {status === "success" && (
                        <>
                            <div className="mx-auto mb-4">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                            <CardTitle className="text-2xl">Payment Successful! 🎉</CardTitle>
                            <CardDescription>
                                Your subscription has been activated
                            </CardDescription>
                        </>
                    )}
                    {status === "pending" && (
                        <>
                            <div className="mx-auto mb-4">
                                <Clock className="w-16 h-16 text-yellow-500" />
                            </div>
                            <CardTitle className="text-2xl">Payment Pending ⏳</CardTitle>
                            <CardDescription>
                                Your payment is being processed
                            </CardDescription>
                        </>
                    )}
                    {status === "failed" && (
                        <>
                            <div className="mx-auto mb-4">
                                <XCircle className="w-16 h-16 text-red-500" />
                            </div>
                            <CardTitle className="text-2xl">Payment Failed ❌</CardTitle>
                            <CardDescription>
                                Something went wrong with your payment
                            </CardDescription>
                        </>
                    )}
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    {status === "success" && (
                        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                ✅ <strong>{credits} AI credits</strong> have been added to your account!
                            </p>
                            <p className="text-sm text-green-800 dark:text-green-200 mt-2">
                                Redirecting to home page in 3 seconds...
                            </p>
                        </div>
                    )}
                    {status === "pending" && (
                        <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⏳ Your subscription will be activated within 24 hours.
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                                You will receive a confirmation email once activated.
                            </p>
                        </div>
                    )}
                    {status === "failed" && (
                        <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                ❌ Your payment could not be processed.
                            </p>
                            <p className="text-sm text-red-800 dark:text-red-200 mt-2">
                                Please try again or contact support if the issue persists.
                            </p>
                        </div>
                    )}
                    {orderId && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                            <p>Order ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{orderId}</code></p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    {status !== "activating" && (
                        <>
                            <Link href="/" className="w-full">
                                <Button className="w-full">
                                    Go to Home
                                </Button>
                            </Link>
                            <Link href="/pricing" className="w-full">
                                <Button variant="outline" className="w-full">
                                    View Plans
                                </Button>
                            </Link>
                        </>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
