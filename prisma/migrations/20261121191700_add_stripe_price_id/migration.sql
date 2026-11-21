/*
  Warnings:

  - A unique constraint covering the columns `[stripePriceId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stripePriceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_stripePriceId_key" ON "Product"("stripePriceId");
