const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const execAsync = promisify(exec);

const ANALYZER_IMAGE = 'devdebt-analyzer:latest';

/**
 * Run Docker-based analysis on a repository
 * 
 * @param {Object} options
 * @param {string} options.cloneUrl - Git clone URL
 * @param {string} options.accessToken - GitHub access token
 * @param {number} options.scanId - Scan ID for logging
 * @returns {Promise<Object>} Analysis results
 */
async function runDockerAnalysis({ cloneUrl, accessToken, scanId }) {
  const containerName = `devdebt-scan-${scanId}-${Date.now()}`;
  
  // Build authenticated clone URL for private repos
  const authCloneUrl = accessToken 
    ? cloneUrl.replace('https://', `https://${accessToken}@`)
    : cloneUrl;

  console.log(`[Docker] Starting analysis container: ${containerName}`);

  try {
    // Run the analyzer container
    const { stdout, stderr } = await execAsync(
      `docker run --rm --name ${containerName} ` +
      `--memory="512m" --cpus="1" ` +

      `-e REPO_URL="${authCloneUrl}" ` +
      `${ANALYZER_IMAGE}`,
      { 
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );

    if (stderr) {
      console.warn(`[Docker] Container stderr: ${stderr}`);
    }

    // Parse JSON output from container
    const results = JSON.parse(stdout);
    console.log(`[Docker] Analysis complete for scan ${scanId}`);
    
    return results;

  } catch (error) {
    console.error(`[Docker] Analysis failed for scan ${scanId}:`, error.message);
    
    // Attempt to clean up container if it's still running
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch (cleanupError) {
      // Container might already be removed, ignore
    }

    throw new Error(`Docker analysis failed: ${error.message}`);
  }
}

/**
 * Build the analyzer Docker image
 */
async function buildAnalyzerImage() {
  const dockerfilePath = path.join(__dirname, '..', '..', 'docker', 'analyzer');
  
  console.log('[Docker] Building analyzer image...');
  
  try {
    const { stdout, stderr } = await execAsync(
      `docker build -t ${ANALYZER_IMAGE} ${dockerfilePath}`,
      { timeout: 600000 } // 10 minute timeout for build
    );
    
    console.log('[Docker] Analyzer image built successfully');
    return true;
  } catch (error) {
    console.error('[Docker] Failed to build analyzer image:', error.message);
    throw error;
  }
}

/**
 * Check if analyzer image exists
 */
async function checkAnalyzerImage() {
  try {
    await execAsync(`docker image inspect ${ANALYZER_IMAGE}`);
    return true;
  } catch {
    return false;
  }
}

module.exports = { 
  runDockerAnalysis, 
  buildAnalyzerImage, 
  checkAnalyzerImage,
  ANALYZER_IMAGE 
};
