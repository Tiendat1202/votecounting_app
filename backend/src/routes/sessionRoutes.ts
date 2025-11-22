import { Router } from 'express';
import { getSessions, createSession } from '../controllers/sessionController';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', apiLimiter, authenticate, getSessions);
router.post('/', apiLimiter, authenticate, authorizeAdmin, createSession);

export default router;
