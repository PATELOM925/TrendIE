import { z } from 'zod';

export const GoatProviderArgsSchema = z.object({
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  sourceRef: z.string().optional(),
  sender: z.string().optional(),
  destination: z.string().optional(),
}).strict();
