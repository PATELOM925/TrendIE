import { z } from 'zod';

export const GoatProviderArgsSchema = z.object({
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
}).strict();
