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

// ---- Benign traffic config (varied domain mix) ----
const BENIGN_HOSTS = [
  'teams.microsoft.com', 'sharepoint.com', 'www.bing.com',
  'calendar.google.com', 'docs.google.com', 'cdn.unpkg.com',
  'gitlab.com', 'notion.so', 'webex.com', 'app.asana.com',
  'www.zendesk.com', 'console.aws.amazon.com', 'cloud.google.com',
  'app.newrelic.com', 'linear.app', 'segment.io',
  'cdn.akamai.net', 'fonts.gstatic.com', 'cdnjs.cloudflare.com',
];

const BENIGN_IPS = [
  '172.16.5.10', '172.16.5.11', '172.16.5.12', '172.16.5.13', '172.16.5.14',
  '172.16.5.20', '172.16.5.21', '172.16.5.42', '172.16.5.88', '172.16.5.101',
];

const URL_CATEGORIES: Record<string, string> = {
  'teams.microsoft.com': 'Business', 'sharepoint.com': 'Business',
  'www.bing.com': 'Technology', 'calendar.google.com': 'Business',
  'docs.google.com': 'Cloud Storage', 'cdn.unpkg.com': 'CDN',
  'gitlab.com': 'Technology', 'notion.so': 'Business',
  'webex.com': 'Business', 'app.asana.com': 'Business',
  'www.zendesk.com': 'Business', 'console.aws.amazon.com': 'Cloud Services',
  'cloud.google.com': 'Cloud Services', 'app.newrelic.com': 'Technology',
  'linear.app': 'Technology', 'segment.io': 'Analytics',
  'cdn.akamai.net': 'CDN', 'fonts.gstatic.com': 'CDN',
  'cdnjs.cloudflare.com': 'CDN',
};

const APP_CLASSES: Record<string, string> = {
  'teams.microsoft.com': 'Collaboration', 'sharepoint.com': 'Enterprise',
  'www.bing.com': 'General Browsing', 'calendar.google.com': 'Enterprise',
  'docs.google.com': 'Cloud Storage', 'cdn.unpkg.com': 'CDN',
  'gitlab.com': 'Development', 'notion.so': 'Collaboration',
  'webex.com': 'Collaboration', 'app.asana.com': 'Enterprise',
  'www.zendesk.com': 'Enterprise', 'console.aws.amazon.com': 'Cloud Services',
  'cloud.google.com': 'Cloud Services', 'app.newrelic.com': 'IT Services',
  'linear.app': 'Development', 'segment.io': 'Analytics',
  'cdn.akamai.net': 'CDN', 'fonts.gstatic.com': 'CDN',
  'cdnjs.cloudflare.com': 'CDN',
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
      cip: overrides.cip ?? '172.16.5.10',
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
  const paths = ['/api/v2/query', '/home', '/settings', '/index.html', '/static/bundle.js', '/favicon.ico', '/auth/callback', '/health'];
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

// ---- 2. Beacon traffic: 50 entries, 172.16.5.42 -> c2.evilbeacon.net ----
// 90s intervals ±37% jitter (CV still < 0.35)
const beaconStart = BASE_EPOCH + 3600;
let beaconTime = beaconStart;
for (let i = 0; i < 50; i++) {
  const jitter = 90 * (1 + (Math.random() * 0.74 - 0.37)); // 90s ±37%
  beaconTime += Math.round(jitter);
  events.push(makeEvent({
    epochtime: beaconTime,
    host: 'c2.evilbeacon.net',
    url: `https://c2.evilbeacon.net/beacon?id=${randInt(1000, 9999)}`,
    cip: '172.16.5.42',
    respcode: 200,
    reqsize: randInt(400, 600),
    respsize: randInt(200, 400),
    totalsize: randInt(600, 1000),
    urlcat: 'Uncategorized',
    urlclass: 'Unknown',
    appclass: 'Unknown',
    appname: 'c2.evilbeacon',
  }));
}

// ---- 3. Exfil traffic: 40 entries, 172.16.5.42 -> upload.anonfiles.io ----
const exfilStart = BASE_EPOCH + 2 * 3600;
for (let i = 0; i < 40; i++) {
  const epoch = exfilStart + randInt(0, 1200);
  const sizeBytes = 4 * 1024 * 1024 + randInt(-200000, 200000);
  events.push(makeEvent({
    epochtime: epoch,
    host: 'upload.anonfiles.io',
    url: `https://upload.anonfiles.io/upload/${randInt(100000, 999999)}`,
    cip: '172.16.5.42',
    reqmethod: 'POST',
    respcode: 200,
    reqsize: sizeBytes,
    respsize: randInt(100, 500),
    totalsize: sizeBytes,
    urlcat: 'File Sharing',
    urlclass: 'Bandwidth Loss',
    appclass: 'File Sharing',
    appname: 'anonfiles',
  }));
}

// ---- 4. Credential stuffing: 30 entries, 203.0.113.45 -> auth.corpacme.net ----
const credStart = BASE_EPOCH + Math.round(2.5 * 3600);
for (let i = 0; i < 30; i++) {
  const epoch = credStart + randInt(0, 300);
  const userNum = (i % 12) + 1;
  events.push(makeEvent({
    epochtime: epoch,
    host: 'auth.corpacme.net',
    url: `https://auth.corpacme.net/oauth/user${userNum}`,
    cip: '203.0.113.45',
    reqmethod: 'POST',
    respcode: 401,
    reqsize: randInt(200, 500),
    respsize: randInt(100, 300),
    totalsize: randInt(300, 800),
    urlcat: 'Corporate Marketing',
    urlclass: 'Business Use',
    appclass: 'Enterprise',
    appname: 'auth',
    login: `user${userNum}@corpacme.net`,
  }));
}

// ---- 5. High-risk allowed: 30 entries, various sources ----
const highRiskHosts = [
  'darkweb-proxy.cc', 'trojan-dropper.ru', 'coinminer-pool.io',
  'spear-phish.net', 'zero-day.xyz', 'rat-c2.org',
];
const highRiskStart = BASE_EPOCH + 3 * 3600;
for (let i = 0; i < 30; i++) {
  const epoch = highRiskStart + randInt(0, 3600);
  const host = pick(highRiskHosts);
  events.push(makeEvent({
    epochtime: epoch,
    host,
    url: `https://${host}/payload/${randInt(1, 100)}`,
    cip: pick(['172.16.5.42', '172.16.5.20', '172.16.5.88', '172.16.5.101']),
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
const outPath = path.resolve(__dirname, '../../example-logs/zscaler-sample-v2.jsonl');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const lines = events.map(e => JSON.stringify(e));
fs.writeFileSync(outPath, lines.join('\n') + '\n');

console.log(`Generated ${events.length} events to ${outPath}`);
console.log(`  Benign:    1350`);
console.log(`  Beacon:    50 (172.16.5.42 -> c2.evilbeacon.net, 90s intervals)`);
console.log(`  Exfil:     40 (172.16.5.42 -> upload.anonfiles.io)`);
console.log(`  CredStuff: 30 (203.0.113.45 -> auth.corpacme.net)`);
console.log(`  HighRisk:  30`);
