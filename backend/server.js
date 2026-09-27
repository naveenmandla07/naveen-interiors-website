const http = require('node:http');
const { appendFile, mkdir, readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DATA_DIR = path.join(__dirname, 'data');
const PAGE_FILE = 'naveen-interiors-v27-bedroom-kitchen-images-fixed.html';
const MAX_BODY_BYTES = 16 * 1024;
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.pause();
        reject(new HttpError(413, 'Request body is too large'));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function text(value, label, maxLength, required = false) {
  if (typeof value !== 'string') {
    if (required) throw new HttpError(400, `${label} is required`);
    return '';
  }
  const result = value.trim();
  if ((required && !result) || result.length > maxLength) {
    throw new HttpError(400, `${label} is required and must be no longer than ${maxLength} characters`);
  }
  return result;
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveRecord(filename, record) {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await appendFile(path.join(DATA_DIR, filename), `${JSON.stringify(record)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
}

async function handleLead(request, response) {
  const input = await readJson(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'A JSON object is required');
  }

  const record = {
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
    name: text(input.name, 'Name', 100, true),
    phone: text(input.phone, 'Phone number', 13, true),
    email: text(input.email, 'Email address', 254, true).toLowerCase(),
    home: text(input.home, 'Home type', 80, true),
    budget: text(input.budget, 'Budget', 60),
    locality: text(input.locality, 'Locality', 120, true),
    message: text(input.message, 'Message', 2000),
    consent: input.consent === true
  };

  if (!validEmail(record.email)) throw new HttpError(400, 'Enter a valid email address');
  if (!/^(?:91-[6-9]\d{9}|[6-9]\d{9})$/.test(record.phone)) {
    throw new HttpError(400, 'Enter a valid Indian phone number: 91-9876543212');
  }
  if (!record.consent) throw new HttpError(400, 'Consent is required to submit this request');

  await saveRecord('leads.jsonl', record);
  sendJson(response, 201, { ok: true, id: record.id });
}

async function handleFeedback(request, response) {
  const input = await readJson(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'A JSON object is required');
  }

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'Choose a rating from 1 to 5');
  }
  const email = text(input.email, 'Email address', 254).toLowerCase();
  if (email && !validEmail(email)) throw new HttpError(400, 'Enter a valid email address');

  const record = {
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
    rating,
    feedback: text(input.feedback, 'Feedback', 2000),
    question: text(input.question, 'Question', 2000),
    email
  };
  await saveRecord('feedback.jsonl', record);
  sendJson(response, 201, { ok: true, id: record.id });
}

async function handleDesignInquiry(request, response) {
  const input = await readJson(request);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'A JSON object is required');
  }

  const record = {
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
    name: text(input.name, 'Name', 100, true),
    email: text(input.email, 'Email address', 254, true).toLowerCase(),
    room: text(input.room, 'Room', 80, true),
    design: text(input.design, 'Design', 160, true),
    question: text(input.question, 'Question', 2000, true),
    consent: input.consent === true
  };

  if (!validEmail(record.email)) throw new HttpError(400, 'Enter a valid email address');
  if (!record.consent) throw new HttpError(400, 'Consent is required to submit this enquiry');

  await saveRecord('design-inquiries.jsonl', record);
  console.info('New design inquiry received', JSON.stringify({
    id: record.id,
    room: record.room,
    design: record.design,
    submittedAt: record.submittedAt
  }));
  sendJson(response, 201, { ok: true, id: record.id });
}

function handleRoomBrief(url, response) {
  const room = text(url.searchParams.get('room'), 'Room', 80, true);
  const design = text(url.searchParams.get('design'), 'Design', 160, true);
  const direction = text(url.searchParams.get('direction'), 'Design direction', 200, true);
  const focus = text(url.searchParams.get('focus'), 'Planning focus', 200, true);
  const materials = url.searchParams.getAll('material').map((material, index) => text(material, `Material ${index + 1}`, 200, true));
  const notes = url.searchParams.getAll('note').map((note, index) => text(note, `Planning note ${index + 1}`, 300, true));
  if (materials.length < 1 || materials.length > 8 || notes.length < 1 || notes.length > 10) {
    throw new HttpError(400, 'The room brief needs a valid materials list and planning notes');
  }

  const brief = [
    'NAVEEN INTERIORS | ROOM CONCEPT BRIEF',
    `Room: ${room}`,
    `Concept: ${design}`,
    `Design direction: ${direction}`,
    `Planning focus: ${focus}`,
    '',
    'MATERIAL PALETTE',
    ...materials,
    '',
    'ROOM PLANNING NOTES',
    ...notes.map(note => `- ${note}`),
    '',
    'Concept references only. Confirm site measurements, availability and final specifications before procurement.'
  ].join('\n');
  const filename = `${design.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room'}-room-brief.txt`;
  response.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': Buffer.byteLength(brief),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(brief);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === `/${PAGE_FILE}`)) {
      const page = await readFile(path.join(FRONTEND_DIR, PAGE_FILE));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': page.length,
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(page);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/leads') {
      await handleLead(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/feedback') {
      await handleFeedback(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/design-inquiries') {
      await handleDesignInquiry(request, response);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/room-brief') {
      handleRoomBrief(url, response);
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    if (response.headersSent) return;
    sendJson(response, error instanceof HttpError ? error.status : 500, {
      error: error instanceof HttpError ? error.message : 'Unable to save your request. Please try again'
    });
    if (!(error instanceof HttpError)) console.error(error);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Naveen Interiors is running at http://${HOST}:${PORT}`);
});