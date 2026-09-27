const {
  ApiError,
  handleError,
  text
} = require('./_lib/shared');

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const room = text(request.query.room, 'Room', 80, true);
    const design = text(request.query.design, 'Design', 160, true);
    const direction = text(request.query.direction, 'Design direction', 200, true);
    const focus = text(request.query.focus, 'Planning focus', 200, true);
    const materials = (Array.isArray(request.query.material) ? request.query.material : [request.query.material])
      .filter(Boolean).map((value, index) => text(value, `Material ${index + 1}`, 200, true));
    const notes = (Array.isArray(request.query.note) ? request.query.note : [request.query.note])
      .filter(Boolean).map((value, index) => text(value, `Planning note ${index + 1}`, 300, true));
    if (materials.length < 1 || materials.length > 8 || notes.length < 1 || notes.length > 10) {
      throw new ApiError(400, 'The room brief needs a valid materials list and planning notes');
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
    response.status(200)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(brief);
  } catch (error) {
    handleError(response, error);
  }
};