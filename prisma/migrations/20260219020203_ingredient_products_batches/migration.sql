-- CreateTable
CREATE TABLE "IngredientProduct" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "packPrice" INTEGER NOT NULL,
    "packQty" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientBatch" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qtyRemaining" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientProduct_ingredientId_key" ON "IngredientProduct"("ingredientId");

-- CreateIndex
CREATE INDEX "IngredientBatch_ingredientId_createdAt_idx" ON "IngredientBatch"("ingredientId", "createdAt");

-- AddForeignKey
ALTER TABLE "IngredientProduct" ADD CONSTRAINT "IngredientProduct_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientBatch" ADD CONSTRAINT "IngredientBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
