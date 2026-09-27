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
      phone: text(input.phone, 'Phone number', 13, true),
      email: text(input.email, 'Email address', 254, true).toLowerCase(),
      home: text(input.home, 'Home type', 80, true),
      budget: text(input.budget, 'Budget', 60),
      locality: text(input.locality, 'Locality', 120, true),
      message: text(input.message, 'Message', 2000),
      consent: input.consent === true
    };
    if (!validEmail(record.email)) throw new ApiError(400, 'Enter a valid email address');
    if (!/^(?:91-[6-9]\d{9}|[6-9]\d{9})$/.test(record.phone)) {
      throw new ApiError(400, 'Enter a valid Indian phone number: 91-9876543212');
    }
    if (!record.consent) throw new ApiError(400, 'Consent is required to submit this request');

    const result = await saveAndNotify('leads', record, notificationEmail('New consultation request', {
      Name: record.name,
      Phone: record.phone,
      Email: record.email,
      'Home type': record.home,
      Budget: record.budget,
      Locality: record.locality,
      Message: record.message
    }));
    sendJson(response, 201, { ok: true, ...result });
  } catch (error) {
    handleError(response, error);
  }
};