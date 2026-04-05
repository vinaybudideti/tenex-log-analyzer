/// <reference types="node" />
import fs from 'fs';
import path from 'path';

const BASE_EPOCH = Math.floor(Date.now() / 1000) - 4 * 3600; // 4 hours ago
const FOUR_HOURS = 4 * 3600;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Benign traffic config ----
const BENIGN_HOSTS = [
  'outlook.office365.com', 'login.microsoftonline.com', 'www.google.com',
  'drive.google.com', 'mail.google.com', 'cdn.jsdelivr.net',
  'api.github.com', 'slack.com', 'zoom.us', 'app.hubspot.com',
  'www.salesforce.com', 'docs.aws.amazon.com', 'portal.azure.com',
  'app.datadoghq.com', 'sentry.io', 'analytics.google.com',
  'cdn.cloudflare.com', 'fonts.googleapis.com', 'unpkg.com',
];

const BENIGN_IPS = [
  '10.0.1.10', '10.0.1.11', '10.0.1.12', '10.0.1.13', '10.0.1.14',
  '10.0.1.20', '10.0.1.21', '10.0.1.22', '10.0.1.30', '10.0.1.31',
];

const URL_CATEGORIES: Record<string, string> = {
  'outlook.office365.com': 'Business', 'login.microsoftonline.com': 'Business',
  'www.google.com': 'Technology', 'drive.google.com': 'Cloud Storage',
  'mail.google.com': 'Business', 'cdn.jsdelivr.net': 'CDN',
  'api.github.com': 'Technology', 'slack.com': 'Business',
  'zoom.us': 'Business', 'app.hubspot.com': 'Business',
  'www.salesforce.com': 'Business', 'docs.aws.amazon.com': 'Technology',
  'portal.azure.com': 'Cloud Storage', 'app.datadoghq.com': 'Technology',
  'sentry.io': 'Technology', 'analytics.google.com': 'Technology',
  'cdn.cloudflare.com': 'CDN', 'fonts.googleapis.com': 'CDN',
  'unpkg.com': 'CDN',
};

const APP_CLASSES: Record<string, string> = {
  'outlook.office365.com': 'Enterprise', 'login.microsoftonline.com': 'Enterprise',
  'www.google.com': 'General Browsing', 'drive.google.com': 'Cloud Storage',
  'mail.google.com': 'Enterprise', 'cdn.jsdelivr.net': 'CDN',
  'api.github.com': 'Development', 'slack.com': 'Collaboration',
  'zoom.us': 'Collaboration', 'app.hubspot.com': 'Enterprise',
  'www.salesforce.com': 'Enterprise', 'docs.aws.amazon.com': 'Cloud Services',
  'portal.azure.com': 'Cloud Services', 'app.datadoghq.com': 'IT Services',
  'sentry.io': 'Development', 'analytics.google.com': 'Analytics',
  'cdn.cloudflare.com': 'CDN', 'fonts.googleapis.com': 'CDN',
  'unpkg.com': 'CDN',
};

type RawEvent = {
  sourcetype: string;
  event: Record<string, string | number>;
};

function makeEvent(overrides: Record<string, string | number>): RawEvent {
  return {
    sourcetype: 'zscalernss-web',
    event: {
      epochtime: String(overrides.epochtime ?? BASE_EPOCH),
      time: new Date(Number(overrides.epochtime ?? BASE_EPOCH) * 1000).toISOString(),
      action: overrides.action ?? 'Allowed',
      host: overrides.host ?? 'example.com',
      url: overrides.url ?? `https://${overrides.host ?? 'example.com'}/`,
      cip: overrides.cip ?? '10.0.1.10',
      sip: overrides.sip ?? '',
      reqmethod: overrides.reqmethod ?? 'GET',
      respcode: String(overrides.respcode ?? 200),
      reqsize: String(overrides.reqsize ?? randInt(200, 2000)),
      respsize: String(overrides.respsize ?? randInt(1000, 50000)),
      totalsize: String(overrides.totalsize ?? randInt(1200, 52000)),
      proto: 'HTTPS',
      riskscore: String(overrides.riskscore ?? 0),
      threatseverity: overrides.threatseverity ?? 'None (0)',
      threatname: overrides.threatname ?? 'None',
      malwarecat: 'None',
      urlcat: overrides.urlcat ?? 'Unknown',
      urlclass: overrides.urlclass ?? 'Unknown',
      appname: overrides.appname ?? 'Unknown',
      appclass: overrides.appclass ?? 'Unknown',
      login: overrides.login ?? '',
      ...overrides,
    },
  };
}

const events: RawEvent[] = [];

// ---- 1. Benign traffic: 1350 entries spread across 4 hours ----
for (let i = 0; i < 1350; i++) {
  const epoch = BASE_EPOCH + randInt(0, FOUR_HOURS);
  const host = pick(BENIGN_HOSTS);
  const cip = pick(BENIGN_IPS);
  const paths = ['/api/v1/data', '/dashboard', '/search', '/index.html', '/assets/main.js', '/favicon.ico', '/login', '/status'];
  events.push(makeEvent({
    epochtime: epoch,
    host,
    url: `https://${host}${pick(paths)}`,
    cip,
    respcode: pick([200, 200, 200, 200, 200, 301, 304]),
    urlcat: URL_CATEGORIES[host] || 'Unknown',
    urlclass: 'Business Use',
    appclass: APP_CLASSES[host] || 'Unknown',
    appname: host.split('.')[0],
  }));
}

// ---- 2. Beacon traffic: 50 entries, 10.0.1.15 -> c2.attacker.xyz ----
// Concentrated in a 50-minute window starting at hour 1
const beaconStart = BASE_EPOCH + 3600; // 1 hour in
let beaconTime = beaconStart;
for (let i = 0; i < 50; i++) {
  const jitter = 60 * (1 + (Math.random() * 0.74 - 0.37)); // 60s ±37%
  beaconTime += Math.round(jitter);
  events.push(makeEvent({
    epochtime: beaconTime,
    host: 'c2.attacker.xyz',
    url: `https://c2.attacker.xyz/beacon?id=${randInt(1000, 9999)}`,
    cip: '10.0.1.15',
    respcode: 200,
    reqsize: randInt(400, 600),
    respsize: randInt(200, 400),
    totalsize: randInt(600, 1000),
    urlcat: 'Uncategorized',
    urlclass: 'Unknown',
    appclass: 'Unknown',
    appname: 'c2.attacker',
  }));
}

// ---- 3. Exfil traffic: 40 entries, 10.0.1.15 -> transfer.sh ----
// Concentrated in a 20-minute window starting at hour 2
const exfilStart = BASE_EPOCH + 2 * 3600;
for (let i = 0; i < 40; i++) {
  const epoch = exfilStart + randInt(0, 1200); // within 20 min
  const sizeBytes = 4 * 1024 * 1024 + randInt(-200000, 200000); // ~4MB ± noise
  events.push(makeEvent({
    epochtime: epoch,
    host: 'transfer.sh',
    url: `https://transfer.sh/upload/${randInt(100000, 999999)}`,
    cip: '10.0.1.15',
    reqmethod: 'POST',
    respcode: 200,
    reqsize: sizeBytes,
    respsize: randInt(100, 500),
    totalsize: sizeBytes,
    urlcat: 'File Sharing',
    urlclass: 'Bandwidth Loss',
    appclass: 'File Sharing',
    appname: 'transfer.sh',
  }));
}

// ---- 4. Credential stuffing: 30 entries, 198.51.100.77 -> okta.safemarch.com ----
// Concentrated in a 5-minute window starting at hour 2.5
const credStart = BASE_EPOCH + Math.round(2.5 * 3600);
for (let i = 0; i < 30; i++) {
  const epoch = credStart + randInt(0, 300); // within 5 min
  const userNum = (i % 12) + 1;
  events.push(makeEvent({
    epochtime: epoch,
    host: 'okta.safemarch.com',
    url: `https://okta.safemarch.com/oauth/user${userNum}`,
    cip: '198.51.100.77',
    reqmethod: 'POST',
    respcode: 401,
    reqsize: randInt(200, 500),
    respsize: randInt(100, 300),
    totalsize: randInt(300, 800),
    urlcat: 'Corporate Marketing',
    urlclass: 'Business Use',
    appclass: 'Enterprise',
    appname: 'okta',
    login: `user${userNum}@safemarch.com`,
  }));
}

// ---- 5. High-risk allowed: 30 entries, various sources ----
// Spread across hour 3
const highRiskHosts = [
  'malware-download.ru', 'shady-vpn.cc', 'crypto-miner.io',
  'phish-kit.net', 'exploit-db.xyz', 'botnet-c2.org',
];
const highRiskStart = BASE_EPOCH + 3 * 3600;
for (let i = 0; i < 30; i++) {
  const epoch = highRiskStart + randInt(0, 3600); // across hour 3
  const host = pick(highRiskHosts);
  events.push(makeEvent({
    epochtime: epoch,
    host,
    url: `https://${host}/payload/${randInt(1, 100)}`,
    cip: pick(['10.0.1.15', '10.0.1.20', '10.0.1.22', '10.0.1.30']),
    respcode: 200,
    riskscore: randInt(80, 95),
    threatseverity: 'High',
    threatname: pick(['Malware', 'Phishing', 'Cryptomining', 'Botnet', 'Exploit']),
    urlcat: 'Malware',
    urlclass: 'Security Risk',
    appclass: 'Unknown',
    appname: host.split('.')[0],
  }));
}

// ---- Sort all events by epochtime for realistic log ordering ----
events.sort((a, b) => Number(a.event.epochtime) - Number(b.event.epochtime));

// ---- Write output ----
const outPath = path.resolve(__dirname, '../../example-logs/zscaler-sample.jsonl');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const lines = events.map(e => JSON.stringify(e));
fs.writeFileSync(outPath, lines.join('\n') + '\n');

console.log(`Generated ${events.length} events to ${outPath}`);
console.log(`  Benign:    1350`);
console.log(`  Beacon:    50`);
console.log(`  Exfil:     40`);
console.log(`  CredStuff: 30`);
console.log(`  HighRisk:  30`);
