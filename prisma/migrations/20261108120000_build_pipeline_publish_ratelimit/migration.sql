-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "supabaseAnonKey" TEXT,
ADD COLUMN     "supabaseUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."Build" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isApp" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "stage" TEXT NOT NULL DEFAULT 'starting',
    "events" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "reasoningEffort" TEXT,
    "llmCalls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "qaIssues" INTEGER NOT NULL DEFAULT 0,
    "reviewSummary" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublishedSite" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fragmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Build_projectId_startedAt_idx" ON "public"."Build"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Build_userId_startedAt_idx" ON "public"."Build"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Build_startedAt_idx" ON "public"."Build"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedSite_slug_key" ON "public"."PublishedSite"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedSite_projectId_key" ON "public"."PublishedSite"("projectId");

-- CreateIndex
CREATE INDEX "PublishedSite_userId_idx" ON "public"."PublishedSite"("userId");

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "public"."RateLimitHit"("key", "createdAt");

