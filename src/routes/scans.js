const express = require('express');
const prisma = require('../prisma');
const { authenticateJWT } = require('../middlewares/auth');
const { getScanQueue } = require('../workers/queue');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /repositories/:repoId/scan
 * Trigger a new scan for a repository
 */
router.post('/:repoId', async (req, res) => {
  const repoId = parseInt(req.params.repoId);

  try {
    // Verify repository ownership
    const repository = await prisma.repository.findFirst({
      where: { 
        id: repoId,
        userId: req.user.id 
      }
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Create scan record
    const scan = await prisma.scan.create({
      data: {
        repositoryId: repository.id,
        status: 'PENDING'
      }
    });

    // Add job to queue
    // We don't await this forever to avoid 504 timeouts if Redis is slow to respond
    // But we want to ensure it's added before we say it's successful if possible
    const enqueueTask = getScanQueue().add('scan-repo', {
      scanId: scan.id,
      repositoryId: repository.id,
      cloneUrl: repository.cloneUrl,
      accessToken: req.user.accessToken
    });

    // Wait for at most 2 seconds for Redis to respond
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Queue timeout')), 2000)
    );

    Promise.race([enqueueTask, timeoutPromise])
      .then(() => {
        console.log(`Scan ${scan.id} enqueued successfully`);
      })
      .catch((err) => {
        console.error(`Failed to enqueue scan ${scan.id}:`, err.message);
        // Even if enqueue fails here, we already created the scan record in PENDING state.
        // The user will see it and we can retry or investigate logs.
      });

    // Return 202 Accepted immediately so Nginx doesn't timeout
    res.status(202).json({
      message: 'Scan triggered',
      scanId: scan.id,
      status: scan.status
    });
  } catch (error) {
    console.error('Error triggering scan:', error);
    res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

/**
 * GET /scans/:id
 * Get scan status and basic info
 */
router.get('/:id', async (req, res) => {
  try {
    const scan = await prisma.scan.findFirst({
      where: { id: parseInt(req.params.id) },
      include: {
        repository: {
          select: { name: true, fullName: true, userId: true }
        }
      }
    });

    if (!scan || scan.repository.userId !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json({
      id: scan.id,
      status: scan.status,
      repositoryName: scan.repository.fullName,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt
    });
  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

/**
 * GET /scans/:id/results
 * Get scan results (debt metrics)
 */
router.get('/:id/results', async (req, res) => {
  try {
    const scan = await prisma.scan.findFirst({
      where: { id: parseInt(req.params.id) },
      include: {
        repository: {
          select: { userId: true }
        },
        metrics: {
          orderBy: { totalDebtScore: 'desc' }
        }
      }
    });

    if (!scan || scan.repository.userId !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    if (scan.status !== 'COMPLETED') {
      return res.status(400).json({ 
        error: 'Scan not completed',
        status: scan.status 
      });
    }

    res.json({
      scanId: scan.id,
      completedAt: scan.completedAt,
      metrics: scan.metrics.map(m => ({
        filePath: m.filePath,
        // Sprawl Metrics
        normalizedLOC: m.normalizedLOC,
        complexityScore: m.complexityScore,
        duplicationRatio: m.duplicationRatio,
        responsibilityScore: m.responsibilityScore,
        couplingScore: m.couplingScore,
        // Results
        sprawlScore: m.sprawlScore,
        sprawlLevel: m.sprawlLevel,
        // Legacy
        cyclomaticComplexity: m.cyclomaticComplexity,
        duplicatedLogicScore: m.duplicatedLogicScore,
        aiEntropyScore: m.aiEntropyScore,
        totalDebtScore: m.totalDebtScore,
        details: m.details
      }))
    });
  } catch (error) {
    console.error('Error fetching scan results:', error);
    res.status(500).json({ error: 'Failed to fetch scan results' });
  }
});

module.exports = router;
