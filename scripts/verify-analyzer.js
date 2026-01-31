
const { runDockerAnalysis } = require('../src/services/docker');

async function verify() {
  console.log('Starting verification...');
  try {
    // using a popular small library for testing
    const results = await runDockerAnalysis({
      cloneUrl: 'https://github.com/uuidjs/uuid.git',
      accessToken: null,
      scanId: 9999
    });
    
    console.log('---------------------------------------------------');
    console.log('Verification Success!');
    console.log(`Analyzed ${results.summary.analyzedFiles} files.`);
    console.log(`Average Complexity: ${results.summary.averageComplexity}`);
    console.log(`Average Debt Score: ${results.summary.averageDebtScore}`);
    console.log('---------------------------------------------------');
    
    // Check if we got file metrics
    if (results.files.length > 0) {
      console.log('Sample file metric:', results.files[0].path);
      console.log('Metrics:', JSON.stringify(results.files[0], null, 2));
    } else {
      console.warn('Warning: No files were analyzed.');
    }

  } catch (error) {
    console.error('Verification Failed:', error);
  }
}

verify();
