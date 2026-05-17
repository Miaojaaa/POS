-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    CONSTRAINT "StockTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockTransfer" ("approvedAt", "approvedById", "createdAt", "createdById", "id", "note", "status") SELECT "approvedAt", "approvedById", "createdAt", "createdById", "id", "note", "status" FROM "StockTransfer";
DROP TABLE "StockTransfer";
ALTER TABLE "new_StockTransfer" RENAME TO "StockTransfer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
