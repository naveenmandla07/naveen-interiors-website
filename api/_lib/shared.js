const MAX_BODY_BYTES = 16 * 1024;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, body) {
  response.status(status).setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.json(body);
}

function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed.join(', '));
  sendJson(response, 405, { error: 'Method not allowed' });
}

async function readJson(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ApiError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'A JSON object is required');
  }
  return value;
}

function text(value, label, maxLength, required = false) {
  if (typeof value !== 'string') {
    if (required) throw new ApiError(400, `${label} is required`);
    return '';
  }
  const result = value.trim();
  if ((required && !result) || result.length > maxLength) {
    throw new ApiError(400, `${label} is required and must be no longer than ${maxLength} characters`);
  }
  return result;
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function saveAndNotify(table, record, email) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new ApiError(503, 'Enquiry storage is not configured. Please try again later');
  }

  const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id,submitted_at`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  });
  if (!databaseResponse.ok) {
    console.error('Supabase insert failed', table, databaseResponse.status, await databaseResponse.text());
    throw new ApiError(502, 'Unable to save your request right now');
  }
  const [savedRecord] = await databaseResponse.json();
  if (!savedRecord?.id) throw new ApiError(502, 'The request was saved but no record ID was returned');

  const notificationSent = await sendNotification(email);
  return { id: savedRecord.id, notificationSent };
}

async function sendNotification({ subject, text: plainText, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) {
    console.warn('Resend notification is not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, text: plainText, html })
    });
    if (!response.ok) {
      console.error('Resend notification failed', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Resend notification request failed', error.message);
    return false;
  }
}

function notificationEmail(title, fields) {
  const rows = Object.entries(fields);
  return {
    subject: title,
    text: rows.map(([label, value]) => `${label}: ${value || '-'}`).join('\n'),
    html: `<h2>${escapeHtml(title)}</h2><dl>${rows.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value || '-').replace(/\n/g, '<br>')}</dd>`).join('')}</dl>`
  };
}

function handleError(response, error) {
  if (response.headersSent) return;
  if (error instanceof ApiError) {
    sendJson(response, error.status, { error: error.message });
    return;
  }
  console.error('Unhandled API error', error);
  sendJson(response, 500, { error: 'Unable to process your request right now' });
}

module.exports = {
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
};