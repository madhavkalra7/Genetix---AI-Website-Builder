-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "attachments" JSONB;

-- AlterTable
ALTER TABLE "public"."AppMessage" ADD COLUMN     "attachments" JSONB;

