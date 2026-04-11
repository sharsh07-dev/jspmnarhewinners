export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const response = {
    status: 'error',
    message: err.message || 'An unexpected error occurred'
  };

  if (err.details) {
    response.validation = err.details;
  }

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}
