/*
  Warnings:

  - Added the required column `qtyinitial` to the `IngredientBatch` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Payment_saleId_key";

-- AlterTable
ALTER TABLE "IngredientBatch" ADD COLUMN     "qtyinitial" DOUBLE PRECISION NOT NULL;
