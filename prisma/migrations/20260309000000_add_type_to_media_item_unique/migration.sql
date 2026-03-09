-- Drop the old (source, externalId) unique index
DROP INDEX "MediaItem_source_externalId_key";

-- Create new (source, externalId, type) unique index so that BOOK and AUDIOBOOK
-- versions of the same Hardcover title can coexist as separate MediaItem rows.
CREATE UNIQUE INDEX "MediaItem_source_externalId_type_key" ON "MediaItem"("source", "externalId", "type");
