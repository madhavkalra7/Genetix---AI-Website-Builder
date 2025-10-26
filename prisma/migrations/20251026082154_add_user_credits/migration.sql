-- CreateTable
CREATE TABLE "public"."UserCredits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsLimit" INTEGER NOT NULL DEFAULT 3,
    "lastReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCredits_userId_key" ON "public"."UserCredits"("userId");

-- CreateIndex
CREATE INDEX "UserCredits_userId_idx" ON "public"."UserCredits"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserCredits" ADD CONSTRAINT "UserCredits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
