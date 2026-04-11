export function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'fail',
    message: `Resource not found: ${req.originalUrl}`
  });
}
