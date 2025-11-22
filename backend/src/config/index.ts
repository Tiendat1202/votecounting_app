export const config = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiration: '1h', // Standard token expiration
  jwtRememberMeExpiration: '7d', // Remember me token expiration
  cookieName: 'token',
  cookieRememberMeMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  cookieStandardMaxAge: 60 * 60 * 1000, // 1 hour in milliseconds
  bcryptRounds: 10,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'],
};
