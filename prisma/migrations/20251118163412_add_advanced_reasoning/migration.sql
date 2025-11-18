-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "advancedReasoning" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."AdvancedReasoningUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancedReasoningUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvancedReasoningUsage_userId_key" ON "public"."AdvancedReasoningUsage"("userId");

-- CreateIndex
CREATE INDEX "AdvancedReasoningUsage_userId_idx" ON "public"."AdvancedReasoningUsage"("userId");

-- CreateIndex
CREATE INDEX "AdvancedReasoningUsage_lastUsedAt_idx" ON "public"."AdvancedReasoningUsage"("lastUsedAt");
