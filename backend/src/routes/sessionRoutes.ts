import { Router } from 'express';
import { getSessions, createSession } from '../controllers/sessionController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getSessions);
router.post('/', authenticate, authorizeAdmin, createSession);

export default router;
