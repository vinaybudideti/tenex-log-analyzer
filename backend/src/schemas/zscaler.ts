import { z } from 'zod';

export const ZscalerEventSchema = z.object({
  sourcetype: z.string().optional(),
  event: z.object({
    epochtime: z.coerce.number().int().positive(),
    time: z.string().optional(),
    login: z.string().optional(),
    action: z.enum(['Allowed', 'Blocked', 'Cautioned', 'Isolated']),
    urlcat: z.string().optional().default('Unknown'),
    urlclass: z.string().optional().default('Unknown'),
    host: z.string(),
    url: z.string(),
    sip: z.string().optional().default(''),
    cip: z.string(),
    reqmethod: z.string().default('GET'),
    respcode: z.coerce.number().int(),
    reqsize: z.coerce.number().int().nonnegative().default(0),
    respsize: z.coerce.number().int().nonnegative().default(0),
    totalsize: z.coerce.number().int().nonnegative().default(0),
    proto: z.string().optional().default('HTTPS'),
    riskscore: z.coerce.number().int().min(0).max(100).default(0),
    threatseverity: z.string().default('None (0)'),
    threatname: z.string().default('None'),
    malwarecat: z.string().default('None'),
    appname: z.string().default('Unknown'),
    appclass: z.string().default('Unknown'),
  }),
});

export type ZscalerEvent = z.infer<typeof ZscalerEventSchema>;
