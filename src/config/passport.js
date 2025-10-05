// backend/src/config/passport.js

import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

dotenv.config();
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('📸 Google profile photo:', profile.photos); // DEBUG
    
    // Buscar usuario existente
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user);
    }
    
    // Crear nuevo usuario - Asegurar que se guarde la foto
    user = new User({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '', // IMPORTANTE
      nickname: profile.displayName.split(' ')[0]
    });
    
    await user.save();
    console.log('Nuevo usuario creado con foto:', user.photo); // DEBUG
    return done(null, user);
    
  } catch (error) {
    console.error('Error en Google strategy:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
