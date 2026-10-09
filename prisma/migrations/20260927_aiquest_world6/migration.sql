-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "aiquestIterationsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiquestUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."AiquestHandoffUse" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiquestHandoffUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiquestHandoffUse_jti_key" ON "public"."AiquestHandoffUse"("jti");

-- CreateIndex
CREATE INDEX "AiquestHandoffUse_expiresAt_idx" ON "public"."AiquestHandoffUse"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_aiquestUserId_key" ON "public"."User"("aiquestUserId");

