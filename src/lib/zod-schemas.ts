import { z } from "zod"

/** YYYY-MM-DD datumformat */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datumformat (YYYY-MM-DD)")

/** HH:MM tidsformat (enkel) */
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Ogiltigt tidsformat (HH:MM)")

/** HH:MM tidsformat (strikt -- validerar timmar 00-23, minuter 00-59) */
export const strictTimeSchema = z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Ogiltigt tidsformat (HH:MM)")
