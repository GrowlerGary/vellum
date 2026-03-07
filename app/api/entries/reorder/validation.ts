import { z } from 'zod'

const reorderSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1),
})

export function validateReorderPayload(data: unknown) {
  return reorderSchema.safeParse(data)
}
