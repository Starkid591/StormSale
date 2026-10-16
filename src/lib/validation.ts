import { z } from 'zod';

export const addressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, { message: 'Invalid Stellar address' });

export const amountSchema = z.coerce
  .number({ invalid_type_error: 'Amount must be a number' })
  .positive({ message: 'Amount must be positive' })
  .finite({ message: 'Amount must be finite' });

export const emailSchema = z.string().email({ message: 'Invalid email address' });

export const urlSchema = z.string().url({ message: 'Invalid URL' });

export const nameSchema = z
  .string()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name must be at most 100 characters' });

export const memoSchema = z
  .string()
  .max(500, { message: 'Memo must be at most 500 characters' })
  .optional();

export const transactionSchema = z.object({
  address: addressSchema,
  amount: amountSchema,
  memo: memoSchema,
});

export const affiliateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  website: urlSchema.optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type AffiliateInput = z.infer<typeof affiliateSchema>;
