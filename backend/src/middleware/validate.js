const { AppError } = require('./errorHandler');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      const firstIssue = err.errors && err.errors[0];
      const message = firstIssue 
        ? `${firstIssue.path.join('.')}: ${firstIssue.message}` 
        : 'Dữ liệu đầu vào không hợp lệ.';
      next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
  };
}

module.exports = {
  validate
};
