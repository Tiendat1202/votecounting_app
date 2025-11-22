import { Router } from 'express';
import { login, logout, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter, apiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.get('/me', apiLimiter, authenticate, getMe);
router.post('/logout', apiLimiter, authenticate, logout);

export default router;
