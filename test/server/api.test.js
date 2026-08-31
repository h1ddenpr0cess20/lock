import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startApp } from '../helpers/app.js';

/** The one MCP server these tests configure. Nothing about it but the label
 *  may reach the page, so the values live here and the leak check reads them
 *  back rather than restating them. */
const MCP = Object.freeze({
  server_label: 'orders',
  server_url: 'https://mcp.example.com/mcp',
  authorization: 'Bearer hunter2',
});

describe('GET /api/config', () => {
  let app;

  before(async () => {
    app = await startApp({ XAI_MCP_SERVERS: JSON.stringify([MCP]) });
  });

  after(() => app.close());

  it('names the pickers and their defaults', async () => {
    const body = await (await app.get('/api/config')).json();

    assert.ok(body.voices.includes(body.voice));
    assert.ok(body.models.includes(body.model));
    assert.equal(body.ready, true);
  });

  it('reports which tools are live by label only', async () => {
    const body = await (await app.get('/api/config')).json();

    assert.equal(body.tools.web_search, true);
    assert.equal(body.tools.x_search, true);
    assert.deepEqual(body.tools.mcp, ['orders']);

    /** The label is the whole of what the page is told. Neither the URL, nor
     *  the host on its own, nor the credential may appear anywhere in it. */
    const raw = JSON.stringify(body);
    const secret = [MCP.server_url, new URL(MCP.server_url).host, MCP.authorization];
    assert.equal(secret.length, 3);
    for (const leak of secret) {
      assert.equal(raw.includes(leak), false, `${leak} reached /api/config`);
    }
  });

  it('names the switches the page may throw, and no others', async () => {
    const body = await (await app.get('/api/config')).json();

    assert.deepEqual(body.switches, [
      { name: 'web_search', label: 'web search' },
      { name: 'x_search', label: 'X search' },
      { name: 'mcp:orders', label: 'orders' },
    ]);
  });

  it('reports a missing key rather than failing at the mic', async () => {
    const bare = await startApp({ XAI_API_KEY: '' });
    try {
      const body = await (await bare.get('/api/config')).json();
      assert.equal(body.ready, false);
    } finally {
      await bare.close();
    }
  });

  it('404s an unknown route', async () => {
    const res = await app.get('/api/nope');
    assert.equal(res.status, 404);
  });
});
