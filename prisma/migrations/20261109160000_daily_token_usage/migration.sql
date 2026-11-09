-- CreateTable
CREATE TABLE "public"."DailyTokenUsage" (
    "day" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTokenUsage_pkey" PRIMARY KEY ("day","group")
);

