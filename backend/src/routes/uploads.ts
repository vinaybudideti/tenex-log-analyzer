import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../auth/middleware';
import { parseZscalerEvent, type ParsedLog } from '../parser/zscaler';
import { runAnalysisPipeline } from '../llm/pipeline';

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'tenex-uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_ENTRIES = 10_000;
const CHUNK_SIZE = 500;
const ALLOWED_EXTENSIONS = ['.jsonl', '.json', '.log', '.txt'];

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    await cleanupFile(file.path);
    return res.status(400).json({
      error: `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    });
  }

  try {
    const content = await fs.readFile(file.path, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    if (lines.length > MAX_LOG_ENTRIES) {
      await cleanupFile(file.path);
      return res.status(400).json({
        error: `File contains ${lines.length} entries. Maximum allowed: ${MAX_LOG_ENTRIES}`,
      });
    }

    const parsed: ParsedLog[] = [];
    let parseErrors = 0;

    for (const line of lines) {
      try {
        const raw = JSON.parse(line);
        const log = parseZscalerEvent(raw);
        parsed.push(log);
      } catch {
        parseErrors++;
      }
    }

    const uploadRecord = await prisma.upload.create({
      data: {
        userId: req.userId!,
        filename: file.originalname,
        sizeBytes: file.size,
        logCount: parsed.length,
        parseErrors,
        status: 'processing',
      },
    });

    // Chunked inserts
    for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
      const chunk = parsed.slice(i, i + CHUNK_SIZE);
      await prisma.logEntry.createMany({
        data: chunk.map(log => ({
          uploadId: uploadRecord.id,
          epochTime: log.epochTime,
          normalizedTime: log.normalizedTime,
          sourceIp: log.sourceIp,
          destHost: log.destHost,
          url: log.url,
          method: log.method,
          respCode: log.respCode,
          reqSize: log.reqSize,
          respSize: log.respSize,
          totalSize: log.totalSize,
          action: log.action,
          riskScore: log.riskScore,
          threatSeverity: log.threatSeverity,
          threatName: log.threatName,
          appClass: log.appClass,
          urlClass: log.urlClass,
          login: log.login,
          rawJson: log.rawJson as object,
        })),
      });
    }

    await cleanupFile(file.path);

    // Fire-and-forget async pipeline
    runAnalysisPipeline(uploadRecord.id).catch(err => {
      console.error({ err, uploadId: uploadRecord.id }, 'Pipeline failed');
      prisma.upload.update({
        where: { id: uploadRecord.id },
        data: { status: 'failed', errorMessage: String(err) },
      }).catch(() => {});
    });

    res.json({
      uploadId: uploadRecord.id,
      logCount: parsed.length,
      parseErrors,
    });
  } catch (err) {
    await cleanupFile(file.path);
    console.error('Upload processing failed:', err);
    res.status(500).json({ error: 'Upload processing failed', details: String(err) });
  }
});

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// GET /api/uploads - list user's uploads
router.get('/', authMiddleware, async (req, res) => {
  try {
    const uploads = await prisma.upload.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true, logCount: true, parseErrors: true, status: true, createdAt: true, completedAt: true },
    });
    res.json({ uploads });
  } catch (err) {
    console.error('Failed to list uploads:', err);
    res.status(500).json({ error: 'Failed to list uploads' });
  }
});

// GET /api/uploads/:id/summary
router.get('/:id/summary', authMiddleware, async (req, res) => {
  try {
    const upload = await prisma.upload.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, userId: true, filename: true, logCount: true, parseErrors: true, status: true, createdAt: true, completedAt: true },
    });
    if (!upload || upload.userId !== req.userId!) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const findings = await prisma.finding.findMany({
      where: { uploadId: upload.id },
      select: { severity: true },
    });

    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: findings.length };
    for (const f of findings) {
      if (f.severity in counts) {
        counts[f.severity as keyof typeof counts]++;
      }
    }

    const { userId: _, ...uploadData } = upload;
    res.json({ upload: uploadData, counts });
  } catch (err) {
    console.error('Failed to get summary:', err);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// GET /api/uploads/:id/incidents
router.get('/:id/incidents', authMiddleware, async (req, res) => {
  try {
    const upload = await prisma.upload.findUnique({ where: { id: req.params.id as string } });
    if (!upload || upload.userId !== req.userId!) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const incidents = await prisma.incident.findMany({
      where: { uploadId: upload.id },
      include: {
        findings: {
          select: {
            id: true, techniqueId: true, techniqueName: true,
            severity: true, confidence: true, sourceIp: true,
            destHost: true, reason: true, evidenceLogIds: true,
          },
        },
      },
    });

    // Sort by severity then startTime desc
    incidents.sort((a, b) => {
      const sevDiff = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
      if (sevDiff !== 0) return sevDiff;
      return b.startTime.getTime() - a.startTime.getTime();
    });

    // Fetch evidence logs for each finding
    const result = await Promise.all(incidents.map(async (inc) => {
      const findingsWithEvidence = await Promise.all(inc.findings.map(async (f) => {
        const logIds = (f.evidenceLogIds as string[]).slice(0, 5);
        const evidence = await prisma.logEntry.findMany({
          where: { id: { in: logIds } },
        });
        const { evidenceLogIds: _, ...findingData } = f;
        return { ...findingData, evidence };
      }));

      return {
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        whatHappened: inc.whatHappened,
        whyItMatters: inc.whyItMatters,
        investigateNext: inc.investigateNext,
        suggestedContain: inc.suggestedContain,
        startTime: inc.startTime,
        endTime: inc.endTime,
        aiGenerated: inc.aiGenerated,
        findings: findingsWithEvidence,
      };
    }));

    res.json({ incidents: result });
  } catch (err) {
    console.error('Failed to get incidents:', err);
    res.status(500).json({ error: 'Failed to get incidents' });
  }
});

// GET /api/uploads/:id/timeline
router.get('/:id/timeline', authMiddleware, async (req, res) => {
  try {
    const upload = await prisma.upload.findUnique({ where: { id: req.params.id as string } });
    if (!upload || upload.userId !== req.userId!) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const findings = await prisma.finding.findMany({
      where: { uploadId: upload.id },
      orderBy: { startTime: 'asc' },
      select: {
        id: true, startTime: true, severity: true,
        techniqueName: true, sourceIp: true, incidentId: true,
      },
    });

    const events = findings.map(f => ({
      id: f.id,
      time: f.startTime.toISOString(),
      type: 'finding' as const,
      severity: f.severity,
      title: `${f.techniqueName}${f.sourceIp ? ` from ${f.sourceIp}` : ''}`,
      incidentId: f.incidentId,
    }));

    const startTime = events.length > 0 ? events[0].time : null;
    const endTime = events.length > 0 ? events[events.length - 1].time : null;

    res.json({ events, startTime, endTime });
  } catch (err) {
    console.error('Failed to get timeline:', err);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

export default router;
