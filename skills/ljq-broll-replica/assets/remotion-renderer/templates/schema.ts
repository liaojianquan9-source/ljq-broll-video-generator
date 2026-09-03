import {z} from 'zod';

export const casePropsSchema = z.object({
  content: z.record(z.string(), z.string()).default({}),
  assets: z.record(z.string(), z.string()).default({}),
  theme: z.record(z.string(), z.string()).default({}),
});

export type CaseProps = z.infer<typeof casePropsSchema>;

export const defaultCaseProps: CaseProps = {
  content: {},
  assets: {},
  theme: {},
};
