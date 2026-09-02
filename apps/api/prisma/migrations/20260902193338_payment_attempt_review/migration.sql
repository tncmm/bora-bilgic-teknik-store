-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "paidWithoutOrderAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT;
