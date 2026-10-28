// Explicit test harness, never imported by application code. This is NOT PostgREST.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRadarDatabase } from './patrimonial-radar-db.mjs';

export async function startRadarBrowserStack() {
  const { db } = await createRadarDatabase();
  const key = randomBytes(32).toString('base64url'), secret = randomBytes(32).toString('base64url');
  const messages = [], logs = [], children = [];
  const sink = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST' || req.headers.apikey !== key) { res.writeHead(403).end('{}'); return; }
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw Error('LIMIT'); }
      const body = JSON.parse(raw);
      if (req.url === '/simulated-email') {
        assert.match(body.email, /\.invalid$/); assert.match(body.code, /^\d{8}$/);
        messages.push(body); res.end('{}'); return;
      }
      if (req.url !== '/rest/v1/rpc/patrimonial_radar_command') { res.writeHead(404).end('{}'); return; }
      const reply = await db.transaction(async tx => {
        await tx.exec('set local role service_role');
        return (await tx.query('select public.patrimonial_radar_command($1::jsonb) as reply', [JSON.stringify(body.p_command)])).rows[0].reply;
      });
      res.end(JSON.stringify(reply));
    } catch { res.writeHead(503).end('{"ok":false,"code":"UNAVAILABLE"}'); }
  });
  sink.listen(0, '127.0.0.1'); await once(sink, 'listening');
  const sinkOrigin = `http://127.0.0.1:${sink.address().port}`;
  async function start(enabled) {
    const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    // No inherited project/provider credentials. All secrets are ephemeral test values.
    const env = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
    Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', PATRIMONIAL_RADAR_MODE: 'VERIFIED_PERSISTENT', PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED: String(enabled), PATRIMONIAL_RADAR_DEMO_ENABLED: String(enabled), PATRIMONIAL_RADAR_DEMO_CONTEXT: 'local-test', PATRIMONIAL_RADAR_BACKEND_ENABLED: String(enabled), PATRIMONIAL_RADAR_BACKEND_CONTEXT: 'local-test', PATRIMONIAL_RADAR_LOCAL_ORIGIN: origin, PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL: sinkOrigin, PATRIMONIAL_RADAR_LOCAL_SIMULATED_EMAIL_URL: `${sinkOrigin}/simulated-email`, PATRIMONIAL_RADAR_LOCAL_SERVER_KEY: key, PATRIMONIAL_RADAR_LOCAL_SECRET: secret });
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port', String(port)], { cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    children.push(child); child.stdout.on('data', b => logs.push(b.toString())); child.stderr.on('data', b => logs.push(b.toString()));
    let lastStatus = 'no response';
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw Error('Local Next test server exited');
      try { const response = await fetch(`${origin}/api/patrimonial-radar/session`); lastStatus = String(response.status); if (response.status === (enabled ? 401 : 404)) return new URL(origin); } catch { /* Wait only for this test process. */ }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw Error(`Local Next test server did not become ready (HTTP ${lastStatus}; ${logs.join('').replaceAll(key,'[test-key]').replaceAll(secret,'[test-secret]').slice(-3000)})`);
  }
  async function stop() {
    for (const child of children) { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } }
    sink.closeAllConnections(); await new Promise(resolve => sink.close(resolve)); await db.close();
  }
  try {
    const base = await start(true), disabled = await start(false);
    return { base, disabled, db, logs, assertSafeLogs() { const log = logs.join(''); for (const message of messages) { assert.ok(!log.includes(message.email)); assert.ok(!log.includes(message.code)); } assert.ok(!log.includes(key) && !log.includes(secret)); }, code(email) { return messages.findLast(m => m.email === email)?.code; }, async unlock() { await db.exec("update patrimonial_radar_private.rate_limits set window_start=clock_timestamp()-interval '2 hours'"); }, stop };
  } catch (error) { await stop(); throw error; }
}
