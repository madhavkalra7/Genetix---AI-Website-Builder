"use client"
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"pending" | "success" | "failed">("pending");
    const orderId = searchParams.get("order_id");
    const paymentStatus = searchParams.get("status");

    useEffect(() => {
        // Check payment status from URL params
        if (paymentStatus === "success") {
            setStatus("success");
        } else if (paymentStatus === "failed") {
            setStatus("failed");
        } else {
            setStatus("pending");
        }
    }, [paymentStatus]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    {status === "success" && (
                        <>
                            <div className="mx-auto mb-4">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                            <CardTitle className="text-2xl">Payment Successful! 🎉</CardTitle>
                            <CardDescription>
                                Thank you for subscribing to our service
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
                                ✅ Your subscription will be activated within <strong>24 hours</strong>.
                            </p>
                            <p className="text-sm text-green-800 dark:text-green-200 mt-2">
                                You will receive a confirmation email once activated.
                            </p>
                        </div>
                    )}
                    {status === "pending" && (
                        <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⏳ Please wait while we confirm your payment.
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                                This usually takes a few minutes. You can close this page.
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
                    <Link href="/projects" className="w-full">
                        <Button className="w-full">
                            Go to Projects
                        </Button>
                    </Link>
                    <Link href="/pricing" className="w-full">
                        <Button variant="outline" className="w-full">
                            View Plans
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
