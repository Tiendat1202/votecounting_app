import { Router } from 'express';
import { getStats } from '../controllers/statsController';
import { authenticate } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', apiLimiter, authenticate, getStats);

export default router;
