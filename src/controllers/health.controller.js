/**
 * Health check - returns server status and uptime info.
 */
export async function getHealth(req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  });
}
