const express = require('express');
const prisma = require('../prisma');
const { authenticateJWT } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * GET /repositories
 * List all repositories for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const repositories = await prisma.repository.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(repositories);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

/**
 * POST /repositories
 * Add a new repository to track
 */
router.post('/', async (req, res) => {
  const { githubRepoId, name, fullName, owner, isPrivate, htmlUrl, cloneUrl } = req.body;

  if (!githubRepoId || !name || !fullName || !owner || !htmlUrl || !cloneUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const repository = await prisma.repository.create({
      data: {
        githubRepoId: String(githubRepoId),
        name,
        fullName,
        owner,
        private: isPrivate || false,
        htmlUrl,
        cloneUrl,
        userId: req.user.id
      }
    });
    res.status(201).json(repository);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Repository already exists' });
    }
    console.error('Error creating repository:', error);
    res.status(500).json({ error: 'Failed to create repository' });
  }
});

/**
 * GET /repositories/:id
 * Get a specific repository
 */
router.get('/:id', async (req, res) => {
  try {
    const repository = await prisma.repository.findFirst({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id 
      },
      include: {
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json(repository);
  } catch (error) {
    console.error('Error fetching repository:', error);
    res.status(500).json({ error: 'Failed to fetch repository' });
  }
});

/**
 * DELETE /repositories/:id
 * Remove a repository from tracking
 */
router.delete('/:id', async (req, res) => {
  try {
    const repository = await prisma.repository.findFirst({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id 
      }
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    await prisma.repository.delete({
      where: { id: repository.id }
    });

    res.json({ success: true, message: 'Repository deleted' });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

module.exports = router;
