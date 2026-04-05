import { ZscalerEventSchema, type ZscalerEvent } from '../schemas/zscaler';

export type ParsedLog = {
  epochTime: number;
  normalizedTime: Date;
  sourceIp: string;
  destHost: string;
  url: string;
  method: string;
  respCode: number;
  reqSize: number;
  respSize: number;
  totalSize: number;
  action: string;
  riskScore: number;
  threatSeverity: string;
  threatName: string;
  appClass: string;
  urlClass: string;
  login: string | null;
  rawJson: ZscalerEvent;
};

export function parseZscalerEvent(raw: unknown): ParsedLog {
  const parsed = ZscalerEventSchema.parse(raw);
  const e = parsed.event;
  return {
    epochTime: e.epochtime,
    normalizedTime: new Date(e.epochtime * 1000),
    sourceIp: e.cip,
    destHost: e.host,
    url: e.url,
    method: e.reqmethod,
    respCode: e.respcode,
    reqSize: e.reqsize,
    respSize: e.respsize,
    totalSize: e.totalsize,
    action: e.action,
    riskScore: e.riskscore,
    threatSeverity: e.threatseverity,
    threatName: e.threatname,
    appClass: e.appclass,
    urlClass: e.urlclass,
    login: e.login || null,
    rawJson: parsed,
  };
}
