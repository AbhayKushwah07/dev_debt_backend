const { Worker } = require('bullmq');
const prisma = require('../prisma');
const { connection } = require('./queue');
const { runDockerAnalysis } = require('../services/docker');

/**
 * Scan Worker - Processes repository scan jobs
 * 
 * Job data:
 * - scanId: ID of the scan record
 * - repositoryId: ID of the repository
 * - cloneUrl: Git clone URL
 * - accessToken: GitHub access token for private repos
 */
const scanWorker = new Worker('scan-queue', async (job) => {
  const { scanId, repositoryId, cloneUrl, accessToken } = job.data;
  
  console.log(`[Worker] Starting scan ${scanId} for repository ${repositoryId}`);

  try {
    // Update scan status to RUNNING
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    // Run Docker-based analysis
    const analysisResults = await runDockerAnalysis({
      cloneUrl,
      accessToken,
      scanId
    });

    // Store metrics in database
    if (analysisResults && analysisResults.files) {
      for (const fileMetric of analysisResults.files) {
        await prisma.debtMetric.create({
          data: {
            scanId,
            filePath: fileMetric.path,
            loc: fileMetric.loc || 0,
            // Sprawl formula metrics
            normalizedLOC: fileMetric.metrics?.normalizedLOC || 0,
            complexityScore: fileMetric.metrics?.complexityScore || 0,
            duplicationRatio: fileMetric.metrics?.duplicationRatio || 0,
            responsibilityScore: fileMetric.metrics?.responsibilityScore || 0,
            couplingScore: fileMetric.metrics?.couplingScore || 0,
            // Legacy metrics
            cyclomaticComplexity: fileMetric.cyclomaticComplexity || 0,
            duplicatedLogicScore: fileMetric.duplicatedLogicScore || 0,
            aiEntropyScore: fileMetric.aiEntropyScore || 0,
            // Sprawl results
            sprawlScore: fileMetric.sprawlScore || 0,
            sprawlLevel: fileMetric.sprawlLevel || 'clean',
            totalDebtScore: fileMetric.totalDebtScore || 0,
            details: fileMetric.details || null
          }
        });
      }

      // Update scan with summary data
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          totalFiles: analysisResults.summary?.totalFiles || 0,
          analyzedFiles: analysisResults.summary?.analyzedFiles || 0,
          avgSprawlScore: analysisResults.summary?.averageDebtScore || 0,
          avgComplexity: analysisResults.summary?.averageComplexity || 0
        }
      });
    }

    // Update scan status to COMPLETED
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    console.log(`[Worker] Scan ${scanId} completed successfully`);
    return { success: true, metricsCount: analysisResults?.files?.length || 0 };

  } catch (error) {
    console.error(`[Worker] Scan ${scanId} failed:`, error);

    // Update scan status to FAILED
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: 'FAILED',
        completedAt: new Date()
      }
    });

    throw error;
  }
}, { connection });

// Worker event handlers
scanWorker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result);
});

scanWorker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error.message);
});

module.exports = scanWorker;
