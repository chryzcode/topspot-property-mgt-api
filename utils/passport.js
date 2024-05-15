import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/user.js";
import bcrypt from "bcryptjs";

async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error("Error hashing password");
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/auth/google/callback",
      passReqToCallback: true,
    },
    async function (request, accessToken, refreshToken, profile, done) {
      const firstName = profile.name.givenName;
      const lastName = profile.name.familyName;
      const email = profile.emails[0].value;

      const exist = await User.findOne({ email });
      if (!exist) {
        await User.create({
          email,
          fullName: `${firstName} ${lastName}`,
          avatar: profile.photos[0].value,
          username: firstName, // You can set the username to the first name if needed
          password: await hashPassword(profile.id),
          verified: true,
        });
      }

      const user = await User.findOne({ email });
      const token = user.createJWT();

      await User.findOneAndUpdate({ email }, { token }, { runValidators: true, new: true });

      return done(null, user);
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});
