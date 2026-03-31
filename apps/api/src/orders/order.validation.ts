import { z } from 'zod';

const phaseSchema = z.object({
  label: z.string().min(2),
  key: z.string().min(2),
  order: z.number().int(),
  include: z.array(z.string()),
  color: z.string(),
});

export const phasesSchema = z
  .array(phaseSchema)
  .refine(
    (phases) => {
      const keys = new Set(phases.map((p) => p.key));
      return keys.size === phases.length;
    },
    { message: 'Keys must be unique' },
  )
  .refine(
    (phases) => {
      const orders = new Set(phases.map((p) => p.order));

      return orders.size === phases.length;
    },
    { message: 'order must be unique' },
  );
