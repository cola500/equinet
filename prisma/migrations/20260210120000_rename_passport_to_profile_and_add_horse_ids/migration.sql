-- Rename HorsePassportToken -> HorseProfileToken
ALTER TABLE "HorsePassportToken" RENAME TO "HorseProfileToken";

-- Add official identification fields to Horse
ALTER TABLE "Horse" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "Horse" ADD COLUMN "microchipNumber" TEXT;
