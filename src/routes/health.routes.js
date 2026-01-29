import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /health - for load balancers and monitoring
router.get('/', getHealth);

export default router;
