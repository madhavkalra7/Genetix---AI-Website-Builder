-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralRewardedAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareId" TEXT;

-- AlterTable
ALTER TABLE "public"."PublishedSite" ADD COLUMN     "showBadge" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."SiteVisit" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "country" TEXT,
    "referrer" TEXT,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVisit_siteId_createdAt_idx" ON "public"."SiteVisit"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareId_key" ON "public"."Project"("shareId");


-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "public"."User"("referredById");
