import { z } from "zod"

/**
 * Stable profile validation schemas
 */
export const createStableSchema = z.object({
  name: z.string().min(1, "Stallnamn krävs").max(100, "Max 100 tecken"),
  description: z.string().max(1000, "Max 1000 tecken").optional(),
  address: z.string().max(200, "Max 200 tecken").optional(),
  city: z.string().max(100, "Max 100 tecken").optional(),
  postalCode: z.string().max(10, "Max 10 tecken").optional(),
  municipality: z.string().max(100, "Max 100 tecken").optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactEmail: z.string().email("Ogiltig email").optional(),
  contactPhone: z.string().max(20, "Max 20 tecken").optional(),
}).strict()

export const updateStableSchema = createStableSchema.partial().strict()

export const createStableSpotSchema = z.object({
  label: z.string().max(50, "Max 50 tecken").optional(),
  status: z.enum(["available", "rented"]).default("available"),
  pricePerMonth: z.number().min(0, "Pris måste vara positivt").optional(),
  availableFrom: z.string().datetime().optional().or(z.string().date().optional()),
  notes: z.string().max(500, "Max 500 tecken").optional(),
}).strict()

export const updateStableSpotSchema = createStableSpotSchema.partial().strict()

export type CreateStableInput = z.infer<typeof createStableSchema>
export type UpdateStableInput = z.infer<typeof updateStableSchema>
export type CreateStableSpotInput = z.infer<typeof createStableSpotSchema>
export type UpdateStableSpotInput = z.infer<typeof updateStableSpotSchema>
