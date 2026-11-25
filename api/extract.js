/**
 * Vercel Serverless Function: /api/extract
 * Extracts actionable tasks from college notices via Make.com webhook
 */

function getKolkataDate() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function cleanCodeFences(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text.trim();
  // Strip leading code fences like ```json, ```JSON, or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Strip trailing code fences like ```
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

module.exports = async function handler(req, res) {
  // CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-make-apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed. Use POST with { "notice": "..." }.'
    });
  }

  // Parse body safely
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request body.' });
    }
  }

  const notice = body?.notice;
  if (!notice || typeof notice !== 'string' || !notice.trim()) {
    return res.status(400).json({
      error: 'Please provide a non-empty "notice" text in the request body.'
    });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({
      error: 'MAKE_WEBHOOK_URL is not configured on the server.'
    });
  }

  const today = getKolkataDate();
  const payload = {
    notice: notice.trim(),
    today: today
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (process.env.MAKE_API_KEY) {
    headers['x-make-apikey'] = process.env.MAKE_API_KEY;
  }

  try {
    const upstreamResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      return res.status(502).json({
        error: `Upstream service responded with status ${upstreamResponse.status}.`,
        details: errorText.slice(0, 300)
      });
    }

    const rawResponseText = await upstreamResponse.text();
    const cleanedText = cleanCodeFences(rawResponseText);

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      return res.status(502).json({
        error: 'Failed to parse response from upstream service as valid JSON.',
        raw: rawResponseText.slice(0, 300)
      });
    }

    // Ensure we return an array of tasks
    let tasks = [];
    if (Array.isArray(parsed)) {
      tasks = parsed;
    } else if (parsed && Array.isArray(parsed.tasks)) {
      tasks = parsed.tasks;
    } else if (parsed && typeof parsed === 'object') {
      // If single task object returned
      if (parsed.task) {
        tasks = [parsed];
      } else {
        tasks = [];
      }
    }

    // Sanitize and validate task object fields
    const sanitizedTasks = tasks.map((t) => ({
      task: t.task || 'Untitled Task',
      subject: t.subject || 'General',
      deadline: t.deadline || null,
      priority: (t.priority || 'medium').toLowerCase(),
      notes: t.notes || ''
    }));

    return res.status(200).json(sanitizedTasks);
  } catch (err) {
    return res.status(500).json({
      error: 'An unexpected error occurred while communicating with the extraction service.',
      message: err.message
    });
  }
};
