-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "knowledge" TEXT;

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "knowledge" TEXT;

-- AlterTable
ALTER TABLE "public"."PublishedSite" ADD COLUMN     "remixCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "showcase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "PublishedSite_showcase_updatedAt_idx" ON "public"."PublishedSite"("showcase", "updatedAt");

