// 통합 테스트용: 실제 redis-server 를 임의 포트로 띄우고, Telegram Bot API / SMTP 를 로컬 가짜 서버로 대체.
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

export async function freePort() {
  return new Promise(res => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

export async function startRedis() {
  const port = await freePort();
  const proc = spawn("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no"], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    const ok = await new Promise(r => { const c = net.connect(port, "127.0.0.1", () => { c.end(); r(true); }).on("error", () => r(false)); });
    if (ok) break;
    await new Promise(r => setTimeout(r, 100));
  }
  return { url: `redis://127.0.0.1:${port}`, stop: () => proc.kill() };
}

// Telegram Bot API 흉내. failNext 로 5xx 를 주입할 수 있다.
export async function startFakeTelegram() {
  const calls = [];
  const state = { failNext: 0, status: 500 };
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const m = req.url.match(/^\/bot([^/]+)\/sendMessage$/);
    if (!m) { res.writeHead(404); return res.end(); }
    if (state.failNext > 0) {
      state.failNext--;
      res.writeHead(state.status, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, description: "injected failure" }));
    }
    const j = JSON.parse(body);
    calls.push({ token: m[1], ...j });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: { message_id: calls.length } }));
  });
  const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
  return { base: `http://127.0.0.1:${port}`, calls, state, stop: () => server.close() };
}

export async function startFakeSmtp() {
  const { SMTPServer } = await import("smtp-server");
  const mails = [];
  const server = new SMTPServer({
    authOptional: true, disabledCommands: ["STARTTLS"],
    onData(stream, session, cb) {
      let raw = "";
      stream.on("data", c => (raw += c));
      stream.on("end", () => { mails.push({ to: session.envelope.rcptTo.map(r => r.address), raw }); cb(); });
    },
  });
  const port = await new Promise(r => server.listen(0, "127.0.0.1", () => r(server.server.address().port)));
  return { url: `smtp://127.0.0.1:${port}`, mails, stop: () => server.close() };
}
