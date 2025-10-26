/*
  Warnings:

  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "public"."Subscription" ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_planId_idx" ON "public"."Payment"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
