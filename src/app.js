import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

/**
 * Create and configure the Express application.
 */
function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging (simple console)
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.use('/health', healthRoutes);

  // 404 handler - must be after all routes
  app.use(notFound);

  // Global error handler - must be last
  app.use(errorHandler);

  return app;
}

export default createApp;
