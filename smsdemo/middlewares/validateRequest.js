export const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

  if (error) {
    const validation = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    const err = new Error('Request validation failed');
    err.statusCode = 400;
    err.details = validation;
    return next(err);
  }

  req.body = value;
  next();
};
