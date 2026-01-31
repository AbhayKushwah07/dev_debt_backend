const { Queue } = require('bullmq');
const config = require('../config');

// Redis connection options
const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

// Lazy queue creation
let _scanQueue = null;

const getScanQueue = () => {
  if (!_scanQueue) {
    _scanQueue = new Queue('scan-queue', { connection });
  }
  return _scanQueue;
};

module.exports = { getScanQueue, connection };
