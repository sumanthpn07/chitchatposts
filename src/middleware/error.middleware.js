/**
 * 404 - route not found
 */
export function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
  });
}

/**
 * Global error handler - catches errors from async routes and middleware.
 * In production, avoid leaking stack traces.
 */
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
