-- AlterTable: make status column on MediaEntry nullable (remove NOT NULL and default)
ALTER TABLE "MediaEntry" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "MediaEntry" ALTER COLUMN "status" DROP DEFAULT;
