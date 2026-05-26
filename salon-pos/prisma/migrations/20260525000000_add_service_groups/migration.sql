-- CreateTable
CREATE TABLE "ServiceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceGroup_name_key" ON "ServiceGroup"("name");

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN "groupId" TEXT REFERENCES "ServiceGroup"("id");
