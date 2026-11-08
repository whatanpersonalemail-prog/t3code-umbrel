#!/usr/bin/env node
// Auto-pairing launcher for T3 Code behind Umbrel's app_proxy.
//
// Runs `t3 serve` on loopback (127.0.0.1:3773) and reverse-proxies
// HTTP + WebSocket traffic on port 3000. On a browser's first visit to "/"
// it mints a one-time pairing code through the T3 CLI and redirects to
// /pair#token=<code>. Safe only behind an authenticating proxy.
//
// All child processes share HOME, so `t3 auth` talks to the same server state
// stored under ~/.t3 (verified: npx t3 auth pairing create --json emits a
// "credential" field).

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const FRONTEND_PORT = Number(process.env.LAUNCHER_PORT || 3000);
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = Number(process.env.T3CODE_PORT || 3773);
const PAIR_COOKIE = "t3code_paired=1";

function runT3(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("t3", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("t3 " + args.join(" ") + " exited " + code + ": " + (stderr || stdout)));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function backendEnv() {
  return {
    ...process.env,
    T3CODE_HOST: BACKEND_HOST,
    T3CODE_PORT: String(BACKEND_PORT),
    T3CODE_NO_BROWSER: "1",
  };
}

async function mintPairingCode() {
  const { stdout } = await runT3(
    ["auth", "pairing", "create", "--ttl", "15m", "--label", "Umbrel", "--json"],
    backendEnv()
  );
  const parsed = JSON.parse(stdout);
  if (!parsed || typeof parsed.credential !== "string" || !parsed.credential) {
    throw new Error("t3 auth pairing create did not return a credential field");
  }
  return parsed.credential;
}

const backend = spawn("t3", ["serve", "--host", BACKEND_HOST, "--port", String(BACKEND_PORT), "--no-browser"], {
  env: backendEnv(),
  stdio: "inherit",
});

function shutdown() {
  try { backend.kill("SIGTERM"); } catch (e) { /* ignore */ }
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
backend.on("exit", (code, signal) => {
  if (signal) return;
  console.error("t3 serve exited with code " + code);
  process.exit(code === 0 ? 1 : (code == null ? 1 : code));
});

async function waitBackend(deadlineMs) {
  deadlineMs = deadlineMs || 60000;
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      await new Promise((resolve, reject) => {
        const s = net.createConnection({ host: BACKEND_HOST, port: BACKEND_PORT }, () => {
          s.end();
          resolve();
        });
        s.on("error", reject);
        s.setTimeout(1000, () => { s.destroy(); reject(new Error("timeout")); });
      });
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("backend did not become ready");
}

function proxyHttpRequest(req, res) {
  const target = http.request(
    {
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    }
  );
  target.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain");
      res.end("bad gateway: " + err.message);
    }
  });
  req.pipe(target);
}

waitBackend().then(() => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const alreadyPaired = (req.headers.cookie || "").includes("t3code_paired=1");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "") && !alreadyPaired) {
      mintPairingCode()
        .then((credential) => {
          res.statusCode = 302;
          res.setHeader("Location", "/pair#token=" + encodeURIComponent(credential));
          res.setHeader("Set-Cookie", PAIR_COOKIE + "; Path=/; HttpOnly; SameSite=Lax");
          res.end();
        })
        .catch((err) => {
          console.error("pairing mint failed:", err.message);
          res.statusCode = 502;
          res.setHeader("Content-Type", "text/plain");
          res.end("pairing mint failed: " + err.message);
        });
      return;
    }

    proxyHttpRequest(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    const target = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
      let raw = req.method + " " + req.url + " HTTP/" + req.httpVersion + "\r\n";
      for (const [k, v] of Object.entries(req.headers)) {
        raw += k + ": " + v + "\r\n";
      }
      raw += "\r\n";
      target.write(raw);
      if (head && head.length) target.write(head);
      socket.pipe(target);
      target.pipe(socket);
    });
    target.on("error", () => { try { socket.destroy(); } catch (e) {} });
    socket.on("error", () => { try { target.destroy(); } catch (e) {} });
  });

  server.listen(FRONTEND_PORT, "0.0.0.0", () => {
    console.log("launcher: proxying 0.0.0.0:" + FRONTEND_PORT + " -> " + BACKEND_HOST + ":" + BACKEND_PORT);
  });
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
