const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * GET /github/repos
 * Fetch repositories from the user's GitHub account
 */
router.get('/repos', async (req, res) => {
  try {
    const accessToken = req.user.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No GitHub access token available' });
    }

    // Fetch repos from GitHub API
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DevDebt-Visualizer'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('GitHub API error:', error);
      return res.status(response.status).json({ 
        error: 'Failed to fetch repositories from GitHub',
        details: error
      });
    }

    const repos = await response.json();
    
    // Map to simpler format
    const mappedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      updatedAt: repo.updated_at
    }));

    res.json(mappedRepos);
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

/**
 * GET /github/repos/:owner/:repo
 * Fetch a specific repository details from GitHub
 */
router.get('/repos/:owner/:repo', async (req, res) => {
  try {
    const accessToken = req.user.accessToken;
    const { owner, repo } = req.params;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No GitHub access token available' });
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DevDebt-Visualizer'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Repository not found or access denied'
      });
    }

    const repoData = await response.json();
    
    res.json({
      id: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      owner: repoData.owner.login,
      description: repoData.description,
      isPrivate: repoData.private,
      htmlUrl: repoData.html_url,
      cloneUrl: repoData.clone_url,
      language: repoData.language,
      defaultBranch: repoData.default_branch,
      stargazersCount: repoData.stargazers_count,
      forksCount: repoData.forks_count
    });
  } catch (error) {
    console.error('Error fetching repo details:', error);
    res.status(500).json({ error: 'Failed to fetch repository details' });
  }
});

module.exports = router;
