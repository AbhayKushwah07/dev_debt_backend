const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Import Routes
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repositories');
const scanRoutes = require('./routes/scans');
const githubRoutes = require('./routes/github');

app.use('/auth', authRoutes);
app.use('/repositories', repoRoutes);
app.use('/scans', scanRoutes);
app.use('/github', githubRoutes);

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

module.exports = app;
