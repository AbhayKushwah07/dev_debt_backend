#!/usr/bin/env node
/**
 * DevDebt Analyzer - Static Analysis Script
 * 
 * This script runs inside a Docker container and:
 * 1. Clones the repository
 * 2. Runs cloc for LOC analysis
 * 3. Computes cyclomatic complexity
 * 4. Detects duplicated logic patterns
 * 5. Calculates AI entropy scores
 * 6. Outputs structured JSON results
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const acorn = require('acorn');
const walk = require('acorn-walk');

const REPO_URL = process.env.REPO_URL;
const WORK_DIR = '/tmp/repo';

async function main() {
  try {
    // Clone repository
    console.error('[Analyzer] Cloning repository...');
    execSync(`git clone --depth 1 ${REPO_URL} ${WORK_DIR}`, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000 
    });

    // Find JavaScript/TypeScript files
    const files = await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: WORK_DIR,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.min.js']
    });

    console.error(`[Analyzer] Found ${files.length} files to analyze`);

    // Run cloc
    let clocData = {};
    try {
      const clocOutput = execSync(`cloc ${WORK_DIR} --json`, { encoding: 'utf-8' });
      clocData = JSON.parse(clocOutput);
    } catch (e) {
      console.error('[Analyzer] cloc failed, continuing without LOC data');
    }

    // Analyze each file
    const results = {
      summary: {
        totalFiles: files.length,
        analyzedFiles: 0,
        averageComplexity: 0,
        averageDebtScore: 0
      },
      files: []
    };

    let totalComplexity = 0;
    let totalDebt = 0;

    for (const file of files) {
      try {
        const filePath = path.join(WORK_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const metrics = analyzeFile(content, file);
        
        if (metrics) {
          results.files.push(metrics);
          results.summary.analyzedFiles++;
          totalComplexity += metrics.cyclomaticComplexity;
          totalDebt += metrics.totalDebtScore;
        }
      } catch (e) {
        console.error(`[Analyzer] Failed to analyze ${file}: ${e.message}`);
      }
    }

    // Calculate averages
    if (results.summary.analyzedFiles > 0) {
      results.summary.averageComplexity = totalComplexity / results.summary.analyzedFiles;
      results.summary.averageDebtScore = totalDebt / results.summary.analyzedFiles;
    }

    // Output JSON to stdout
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('[Analyzer] Fatal error:', error.message);
    process.exit(1);
  }
}

/**
 * Analyze a single file using Sprawl Detection Formula
 * S = w1*N + w2*C + w3*D + w4*R + w5*K
 * 
 * Where:
 * N = Normalized LOC (actual/ideal)
 * C = Complexity score (CC/max)
 * D = Duplication ratio
 * R = Responsibility score
 * K = Coupling score (dependencies)
 */
function analyzeFile(content, filePath) {
  const lines = content.split('\n');
  const loc = lines.length;

  // Skip very small files
  if (loc < 5) return null;

  // Weights (sum = 1)
  const weights = {
    size: 0.25,
    complexity: 0.30,
    duplication: 0.20,
    responsibility: 0.15,
    coupling: 0.10
  };

  // 1️⃣ Normalized LOC (N) - Size Sprawl
  const IDEAL_LOC = 30;
  const normalizedLOC = loc / IDEAL_LOC;

  // 2️⃣ Complexity Score (C) - Logical Sprawl
  const cyclomaticComplexity = calculateCyclomaticComplexity(content);
  const CC_MAX = 10;
  const complexityScore = cyclomaticComplexity / CC_MAX;

  // 3️⃣ Duplication Ratio (D) - Copy-paste Sprawl
  const duplicationRatio = calculateDuplicationRatio(content);

  // 4️⃣ Responsibility Score (R) - Single-responsibility Violation
  const responsibilityScore = calculateResponsibilityScore(content);

  // 5️⃣ Coupling Score (K) - Dependency Sprawl
  const couplingScore = calculateCouplingScore(content);

  // Calculate Sprawl Score
  const sprawlScore = (
    (weights.size * normalizedLOC) +
    (weights.complexity * complexityScore) +
    (weights.duplication * duplicationRatio) +
    (weights.responsibility * responsibilityScore) +
    (weights.coupling * couplingScore)
  );

  // AI Entropy Penalty (U = unused patterns)
  const aiEntropyFactor = calculateAIEntropyFactor(content);
  const adjustedSprawlScore = sprawlScore * (1 + aiEntropyFactor);

  // Determine sprawl level
  let sprawlLevel;
  if (adjustedSprawlScore < 0.8) sprawlLevel = 'clean';
  else if (adjustedSprawlScore < 1.2) sprawlLevel = 'mild';
  else if (adjustedSprawlScore < 1.6) sprawlLevel = 'high';
  else sprawlLevel = 'severe';

  return {
    path: filePath,
    loc,
    metrics: {
      normalizedLOC: Math.round(normalizedLOC * 100) / 100,
      complexityScore: Math.round(complexityScore * 100) / 100,
      duplicationRatio: Math.round(duplicationRatio * 100) / 100,
      responsibilityScore: Math.round(responsibilityScore * 100) / 100,
      couplingScore: Math.round(couplingScore * 100) / 100,
      aiEntropyFactor: Math.round(aiEntropyFactor * 100) / 100
    },
    cyclomaticComplexity: Math.round(cyclomaticComplexity * 100) / 100,
    duplicatedLogicScore: Math.round(duplicationRatio * 100),
    aiEntropyScore: Math.round(aiEntropyFactor * 100),
    totalDebtScore: Math.round(adjustedSprawlScore * 100) / 100,
    sprawlScore: Math.round(adjustedSprawlScore * 100) / 100,
    sprawlLevel,
    details: {
      hasLongFunctions: loc > 50,
      hasDeepNesting: hasDeepNesting(content),
      hasRepetitivePatterns: duplicationRatio > 0.1,
      hasHighCoupling: couplingScore > 1.0,
      hasTooManyResponsibilities: responsibilityScore > 1.5
    }
  };
}

/**
 * Calculate cyclomatic complexity
 * Based on counting decision points
 */
function calculateCyclomaticComplexity(content) {
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*.*\s*:/g,  // Ternary
    /&&/g,
    /\|\|/g
  ];

  let complexity = 1; // Base complexity

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  // Normalize by LOC (per 100 lines)
  const loc = content.split('\n').length;
  return (complexity / loc) * 100;
}

/**
 * Calculate duplication ratio (D)
 * D = Duplicated LOC / Total LOC
 */
function calculateDuplicationRatio(content) {
  const lines = content.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('import'));

  if (lines.length === 0) return 0;

  const lineFrequency = {};
  
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ');
    lineFrequency[normalized] = (lineFrequency[normalized] || 0) + 1;
  }

  // Count lines that appear more than once
  let duplicatedLines = 0;
  for (const count of Object.values(lineFrequency)) {
    if (count > 1) {
      duplicatedLines += count - 1;
    }
  }

  // Return ratio (0 to 1)
  return duplicatedLines / lines.length;
}

/**
 * Calculate responsibility score (R)
 * R = Number of responsibilities / Ideal responsibilities
 * Measured by: distinct operations, method calls, logical sections
 */
function calculateResponsibilityScore(content) {
  const IDEAL_RESPONSIBILITIES = 2;
  
  // Count distinct responsibility indicators
  let responsibilities = 0;
  
  // Count function/method definitions
  const functionDefs = content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g) || [];
  responsibilities += functionDefs.length * 0.5;
  
  // Count different types of operations
  const httpPatterns = content.match(/\.(get|post|put|delete|patch)\s*\(/gi) || [];
  responsibilities += httpPatterns.length * 0.3;
  
  // Count state mutations
  const statePatterns = content.match(/\.set\s*\(|setState|\.update\s*\(|\.push\s*\(|\.splice\s*\(/gi) || [];
  responsibilities += statePatterns.length * 0.2;
  
  // Count distinct external calls
  const awaitCalls = content.match(/await\s+\w+/g) || [];
  responsibilities += awaitCalls.length * 0.1;
  
  // Count class methods if it's a class
  const classMethods = content.match(/^\s*(async\s+)?\w+\s*\([^)]*\)\s*{/gm) || [];
  responsibilities += classMethods.length * 0.3;
  
  // Normalize: responsibilities / ideal
  return Math.max(1, responsibilities) / IDEAL_RESPONSIBILITIES;
}

/**
 * Calculate coupling score (K)
 * K = Dependencies / Max allowed dependencies
 */
function calculateCouplingScore(content) {
  const MAX_ALLOWED_DEPENDENCIES = 5;
  
  // Count import statements
  const importMatches = content.match(/^import\s+.*from\s+['"]/gm) || [];
  const requireMatches = content.match(/require\s*\(\s*['"]/g) || [];
  
  // Count external references (excluding common globals)
  const externalRefs = content.match(/\b(axios|fetch|http|fs|path|prisma|socket|redis|mongo)\b/gi) || [];
  
  const totalDependencies = importMatches.length + requireMatches.length + 
    [...new Set(externalRefs.map(r => r.toLowerCase()))].length;
  
  return totalDependencies / MAX_ALLOWED_DEPENDENCIES;
}

/**
 * Calculate AI Entropy Factor (U)
 * Penalizes AI over-generation patterns
 * S_AI = S × (1 + U) where U = Unused code patterns / Total LOC
 */
function calculateAIEntropyFactor(content) {
  const loc = content.split('\n').length;
  if (loc === 0) return 0;
  
  // Common AI-generated patterns that indicate low entropy
  const aiPatterns = [
    /TODO:?\s*(implement|add|fix|handle)/gi,
    /\/\/\s*\.\.\./g,
    /console\.log\(['"](debug|test|here)/gi,
    /\bany\b/g,  // TypeScript 'any' overuse
    /\/\*\*[\s\S]*?\*\//g,  // Excessive JSDoc (AI loves these)
    /throw new Error\(['"]Not implemented/gi,
    /\/\/\s*eslint-disable/gi,
  ];

  let patternCount = 0;
  for (const pattern of aiPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      patternCount += matches.length;
    }
  }

  // Check for structural repetition (similar function signatures)
  const functionSignatures = content.match(/function\s+\w+\s*\([^)]*\)/g) || [];
  const arrowFunctions = content.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
  
  const allSignatures = [...functionSignatures, ...arrowFunctions];
  const signaturePatterns = {};
  
  for (const sig of allSignatures) {
    const params = sig.match(/\([^)]*\)/)?.[0] || '';
    const paramCount = (params.match(/,/g) || []).length + (params.length > 2 ? 1 : 0);
    const pattern = `params_${paramCount}`;
    signaturePatterns[pattern] = (signaturePatterns[pattern] || 0) + 1;
  }

  // High similarity in function signatures suggests AI generation
  let signatureSimilarity = 0;
  const values = Object.values(signaturePatterns);
  if (values.length > 0 && allSignatures.length > 3) {
    const max = Math.max(...values);
    signatureSimilarity = (max / allSignatures.length) * 0.3;
  }

  // Calculate unused code ratio (approximation)
  const unusedRatio = (patternCount / loc) * 0.5;
  
  // Return factor between 0 and 0.5 (max 50% penalty)
  return Math.min(0.5, unusedRatio + signatureSimilarity);
}

/**
 * Check for long functions (over 50 lines)
 */
function hasLongFunctions(content) {
  const functionBlocks = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
  return functionBlocks.some(block => block.split('\n').length > 50);
}

/**
 * Check for deep nesting (> 4 levels)
 */
function hasDeepNesting(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
    if (indent > 16) { // 4 levels * 4 spaces
      return true;
    }
  }
  return false;
}

main();
