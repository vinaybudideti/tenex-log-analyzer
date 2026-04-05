import { prisma } from '../lib/prisma';

export async function runAnalysisPipeline(uploadId: string): Promise<void> {
  console.log(`[STUB] Pipeline called for upload ${uploadId}`);
  // Real implementation in Task 4.5
  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: 'completed', completedAt: new Date() },
  });
}
