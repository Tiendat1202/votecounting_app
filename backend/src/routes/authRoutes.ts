import { Router } from 'express';
import { login, logout, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
