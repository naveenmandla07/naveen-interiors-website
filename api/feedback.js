const {
  ApiError,
  handleError,
  methodNotAllowed,
  notificationEmail,
  readJson,
  requireObject,
  saveAndNotify,
  sendJson,
  text,
  validEmail
} = require('./_lib/shared');

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
  try {
    const input = requireObject(await readJson(request));
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Choose a rating from 1 to 5');
    }
    const email = text(input.email, 'Email address', 254).toLowerCase();
    if (email && !validEmail(email)) throw new ApiError(400, 'Enter a valid email address');
    const record = {
      rating,
      feedback: text(input.feedback, 'Feedback', 2000),
      question: text(input.question, 'Question', 2000),
      email: email || null
    };
    const result = await saveAndNotify('feedback', record, notificationEmail('New website feedback', {
      Rating: `${rating} out of 5`,
      Feedback: record.feedback,
      Question: record.question,
      Email: record.email
    }));
    sendJson(response, 201, { ok: true, ...result });
  } catch (error) {
    handleError(response, error);
  }
};