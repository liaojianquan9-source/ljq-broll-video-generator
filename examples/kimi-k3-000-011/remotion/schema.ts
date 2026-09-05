import {z} from 'zod';

export const casePropsSchema = z.object({
  motionEnabled: z.boolean().default(true),
  earthTitle: z.string(),
  parameterLabel: z.string(),
  emphasisCharacter: z.string(),
  openSourceTitle: z.string(),
  mainNumber: z.string(),
  billionUnit: z.string(),
  parameterUnit: z.string(),
  weightsLabel: z.string(),
  annotationCopy: z.string(),
  moonTitle: z.string(),
  kimiTitle: z.string(),
  k3Title: z.string(),
  backgroundDark: z.string(),
  aRollBackground: z.string(),
  primaryBlue: z.string(),
  iceBlue: z.string(),
  accentCyan: z.string(),
  paperWhite: z.string(),
  displayFont: z.string(),
  numberFont: z.string(),
  numberColors: z.array(z.string()).length(5),
  latinFont: z.string(),
  scriptFont: z.string(),
  moonTopImage: z.string(),
  moonBottomImage: z.string(),
  moonTexture: z.string(),
});

export type CaseProps = z.infer<typeof casePropsSchema>;
