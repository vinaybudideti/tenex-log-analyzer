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

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

export default router;
