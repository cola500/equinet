import { z } from "zod"

const currentYear = new Date().getFullYear()

export const horseCreateSchema = z.object({
  name: z.string().min(1, "Hästens namn krävs").max(100, "Namn för långt (max 100 tecken)"),
  breed: z.string().max(100, "Ras för lång (max 100 tecken)").optional(),
  birthYear: z.number()
    .int("Födelseår måste vara ett heltal")
    .min(1980, "Födelseår kan inte vara före 1980")
    .max(currentYear, "Födelseår kan inte vara i framtiden")
    .optional(),
  color: z.string().max(50, "Färg för lång (max 50 tecken)").optional(),
  gender: z.enum(["mare", "gelding", "stallion"], {
    message: "Kön måste vara mare, gelding eller stallion",
  }).optional(),
  specialNeeds: z.string().max(1000, "Specialbehov för lång text (max 1000 tecken)").optional(),
  registrationNumber: z.string().max(15, "Registreringsnummer för långt (max 15 tecken)").optional(),
  microchipNumber: z.string().max(15, "Chipnummer för långt (max 15 tecken)").optional(),
}).strict()

export const horseUpdateSchema = z.object({
  name: z.string().min(1, "Hästens namn krävs").max(100, "Namn för långt (max 100 tecken)").optional(),
  breed: z.string().max(100, "Ras för lång (max 100 tecken)").nullable().optional(),
  birthYear: z.number()
    .int("Födelseår måste vara ett heltal")
    .min(1980, "Födelseår kan inte vara före 1980")
    .max(currentYear, "Födelseår kan inte vara i framtiden")
    .nullable()
    .optional(),
  color: z.string().max(50, "Färg för lång (max 50 tecken)").nullable().optional(),
  gender: z.enum(["mare", "gelding", "stallion"], {
    message: "Kön måste vara mare, gelding eller stallion",
  }).nullable().optional(),
  specialNeeds: z.string().max(1000, "Specialbehov för lång text (max 1000 tecken)").nullable().optional(),
  registrationNumber: z.string().max(15, "Registreringsnummer för långt (max 15 tecken)").nullable().optional(),
  microchipNumber: z.string().max(15, "Chipnummer för långt (max 15 tecken)").nullable().optional(),
}).strict()
