const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const prisma = require('../prisma');
const config = require('../config');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GitHubStrategy({
    clientID: config.github.clientId,
    clientSecret: config.github.clientSecret,
    callbackURL: config.github.callbackUrl
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create user
      const user = await prisma.user.upsert({
        where: { githubId: profile.id },
        update: {
          accessToken: accessToken, // In production, encrypt this!
          username: profile.username,
          displayName: profile.displayName || profile.username,
          avatarUrl: profile.photos?.[0]?.value
        },
        create: {
          githubId: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          avatarUrl: profile.photos?.[0]?.value,
          accessToken: accessToken
        }
      });
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwtSecret
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (err) {
    return done(err, false);
  }
}));

module.exports = passport;
