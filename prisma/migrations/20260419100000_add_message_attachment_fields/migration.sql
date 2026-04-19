-- S46-0: Add image attachment fields to Message
-- Three nullable columns: path, MIME type, size in bytes.
-- All three are null for text-only messages (invariant enforced by API).

ALTER TABLE "Message"
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "attachmentType" TEXT,
  ADD COLUMN "attachmentSize" INTEGER;
