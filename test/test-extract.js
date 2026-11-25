const http = require('http');
const assert = require('assert');
const extractHandler = require('../api/extract.js');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
}

async function runTests() {
  console.log('--- Starting TaskNudge Backend Tests ---');

  // Test 1: Method not allowed (GET)
  {
    const req = { method: 'GET', body: {} };
    const res = createMockRes();
    await extractHandler(req, res);
    assert.strictEqual(res.statusCode, 405, 'GET should return 405');
    assert.ok(res.body.error.includes('Method Not Allowed'));
    console.log('✓ Test 1 Passed: 405 Method Not Allowed on non-POST');
  }

  // Test 2: Missing notice
  {
    const req = { method: 'POST', body: { notice: '   ' } };
    const res = createMockRes();
    await extractHandler(req, res);
    assert.strictEqual(res.statusCode, 400, 'Empty notice should return 400');
    assert.ok(res.body.error.includes('notice'));
    console.log('✓ Test 2 Passed: 400 Bad Request on empty notice');
  }

  // Test 3: Missing MAKE_WEBHOOK_URL env
  {
    delete process.env.MAKE_WEBHOOK_URL;
    const req = { method: 'POST', body: { notice: 'Test notice' } };
    const res = createMockRes();
    await extractHandler(req, res);
    assert.strictEqual(res.statusCode, 500, 'Missing webhook URL should return 500');
    console.log('✓ Test 3 Passed: 500 when MAKE_WEBHOOK_URL is not set');
  }

  // Test 4: Successful mock webhook interaction with code fences in response
  {
    const originalFetch = global.fetch;
    let interceptedUrl = null;
    let interceptedOptions = null;

    global.fetch = async (url, options) => {
      interceptedUrl = url;
      interceptedOptions = options;
      const mockResponseText = "```json\n" + JSON.stringify([
        {
          task: "Submit Assignment 2",
          subject: "Machine Learning",
          deadline: "2026-11-28",
          priority: "high",
          notes: "Must be submitted before 5 PM"
        },
        {
          task: "Library book return",
          subject: "Library",
          deadline: "2026-12-01",
          priority: "low",
          notes: ""
        }
      ]) + "\n```";

      return {
        ok: true,
        status: 200,
        text: async () => mockResponseText
      };
    };

    process.env.MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/mock-endpoint';
    process.env.MAKE_API_KEY = 'secret-api-key-123';

    const req = {
      method: 'POST',
      body: { notice: 'Submit Assignment 2 for Machine Learning by Nov 28.' }
    };
    const res = createMockRes();

    await extractHandler(req, res);

    global.fetch = originalFetch;

    assert.strictEqual(res.statusCode, 200, 'Should return 200 on success');
    assert.ok(Array.isArray(res.body), 'Response should be an array');
    assert.strictEqual(res.body.length, 2, 'Should have 2 tasks');
    assert.strictEqual(res.body[0].task, 'Submit Assignment 2');
    assert.strictEqual(res.body[0].priority, 'high');

    // Check upstream payload and headers
    assert.strictEqual(interceptedUrl, 'https://hook.eu1.make.com/mock-endpoint');
    assert.strictEqual(interceptedOptions.headers['x-make-apikey'], 'secret-api-key-123');
    assert.strictEqual(interceptedOptions.headers['Content-Type'], 'application/json');

    const receivedPayload = JSON.parse(interceptedOptions.body);
    assert.strictEqual(receivedPayload.notice, 'Submit Assignment 2 for Machine Learning by Nov 28.');
    assert.ok(typeof receivedPayload.today === 'string');
    assert.match(receivedPayload.today, /^\d{4}-\d{2}-\d{2}$/, 'Today should be YYYY-MM-DD');

    console.log(`✓ Test 4 Passed: Webhook payload forwarding, x-make-apikey header, today date format (${receivedPayload.today}), code-fence stripping and JSON parsing`);
  }

  // Test 5: Malformed upstream response handling
  {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => 'Not valid JSON at all'
    });

    process.env.MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/mock-endpoint';
    const req = { method: 'POST', body: { notice: 'Some notice' } };
    const res = createMockRes();

    await extractHandler(req, res);
    global.fetch = originalFetch;

    assert.strictEqual(res.statusCode, 502, 'Malformed upstream response should return 502');
    assert.ok(res.body.error.includes('Failed to parse response'));

    console.log('✓ Test 5 Passed: 502 Bad Gateway returned on malformed upstream response');
  }

  // Test 6: Upstream HTTP error response handling (e.g. 500 from webhook)
  {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error on Make'
    });

    process.env.MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/mock-endpoint';
    const req = { method: 'POST', body: { notice: 'Some notice' } };
    const res = createMockRes();

    await extractHandler(req, res);
    global.fetch = originalFetch;

    assert.strictEqual(res.statusCode, 502, 'Upstream 500 should return 502 to client');
    assert.ok(res.body.error.includes('Upstream service responded with status 500'));

    console.log('✓ Test 6 Passed: 502 Bad Gateway with upstream status on HTTP error');
  }

  console.log('--- All Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
