import { z } from "zod"

export const acceptInviteSchema = z.object({
  password: z.string()
    .min(8, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(/[A-Z]/, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(/[a-z]/, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(/[0-9]/, "Lösenordet måste innehålla minst en siffra")
    .regex(/[^A-Za-z0-9]/, "Lösenordet måste innehålla minst ett specialtecken"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Lösenorden matchar inte",
  path: ["confirmPassword"],
})

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
