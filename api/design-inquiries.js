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
    const record = {
      name: text(input.name, 'Name', 100, true),
      email: text(input.email, 'Email address', 254, true).toLowerCase(),
      room: text(input.room, 'Room', 80, true),
      design: text(input.design, 'Design', 160, true),
      question: text(input.question, 'Question', 2000, true),
      consent: input.consent === true
    };
    if (!validEmail(record.email)) throw new ApiError(400, 'Enter a valid email address');
    if (!record.consent) throw new ApiError(400, 'Consent is required to submit this enquiry');
    const result = await saveAndNotify('design_inquiries', record, notificationEmail('New room design enquiry', {
      Name: record.name,
      Email: record.email,
      Room: record.room,
      Design: record.design,
      Question: record.question
    }));
    sendJson(response, 201, { ok: true, ...result });
  } catch (error) {
    handleError(response, error);
  }
};