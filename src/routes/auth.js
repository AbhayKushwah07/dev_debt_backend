const express = require('express');
const passport = require('../services/passport');
const { generateToken } = require('../middlewares/auth');

const router = express.Router();

// GitHub OAuth - Initiate
router.get('/github', passport.authenticate('github', { 
  scope: ['user:email', 'repo'],
  session: false 
}));

// GitHub OAuth - Callback
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login', session: false }),
  (req, res) => {
    // Generate JWT for the authenticated user
    const token = generateToken(req.user);
    
    // Redirect to frontend with token as query param
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  }
);

// Get current user (protected route)
router.get('/me', 
  require('../middlewares/auth').authenticateJWT,
  (req, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl
    });
  }
);

// Logout (client-side: just delete the token)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
