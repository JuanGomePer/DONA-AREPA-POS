-- CreateEnum
CREATE TYPE "DishCategory" AS ENUM ('STARTER', 'MAIN', 'DRINK');

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "category" "DishCategory" NOT NULL DEFAULT 'MAIN';
