const app = require('./app');
const config = require('./config');
const prisma = require('./prisma');

const startServer = async () => {
  try {
    // Check Database Connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
