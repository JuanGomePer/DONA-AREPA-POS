/*
  Warnings:

  - You are about to drop the column `cashReceived` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `changeGiven` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "cashReceived",
DROP COLUMN "changeGiven";
