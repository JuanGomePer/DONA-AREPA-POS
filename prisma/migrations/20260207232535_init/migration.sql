/*
  Warnings:

  - A unique constraint covering the columns `[type,value]` on the table `Denomination` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Denomination_type_value_key" ON "Denomination"("type", "value");
