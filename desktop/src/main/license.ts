import { app, BrowserWindow, ipcMain } from "electron";
import { createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ============ 可改配置 ============
const APP_NAME = "OpenFic"; // 改成你二改后的软件名
const PREFIX = "OPENFIC"; // 激活码前缀，需和 gen_license.py 保持一致
// =================================

// 公钥（来自 license_public.pem，只能验签、不能造码，安全）
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAH4U61cLc/taoDOUNS71bOpLpIaFyibPUSKwMfJ+ZE10=
-----END PUBLIC KEY-----`;

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64url");
}

function isValid(code: string): boolean {
  const m = code
    .trim()
    .match(new RegExp(`^${PREFIX}\\.([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`));
  if (!m) return false;
  try {
    const orderId = b64urlDecode(m[1]);
    const sig = b64urlDecode(m[2]);
    const pub = createPublicKey(PUBLIC_KEY_PEM);
    return verify(null, orderId, pub, sig);
  } catch {
    return false;
  }
}

function licenseFile(): string {
  return join(app.getPath("userData"), "license.txt");
}

// 激活窗口 HTML，风格对齐 OpenFic：黑白灰、圆角 10px、衬线字体
const ACTIVATION_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<style>
  :root {
    --bg: #ffffff;
    --fg: #252525;
    --muted: #8d8d8d;
    --line: #ebebeb;
    --input-bg: #f7f7f7;
    --radius: 10px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia,
      "PingFang SC", "Microsoft YaHei", serif;
    background: var(--bg);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }
  .card { width: 328px; display: flex; flex-direction: column; gap: 18px; }
  .brand { font-size: 15px; letter-spacing: 0.3px; }
  .brand b { font-weight: 600; }
  h1 { font-size: 21px; font-weight: 500; letter-spacing: 0.5px; line-height: 1.3; }
  .sub { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .field { display: flex; flex-direction: column; gap: 8px; }
  input {
    width: 100%;
    height: 42px;
    border: 1px solid var(--line);
    background: var(--input-bg);
    border-radius: var(--radius);
    padding: 0 12px;
    font-size: 12.5px;
    font-family: "JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace;
    color: var(--fg);
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  input:focus { border-color: var(--fg); background: #fff; }
  .err { font-size: 12px; color: #d13438; display: none; }
  button {
    width: 100%;
    height: 42px;
    background: var(--fg);
    color: #ffffff;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-family: inherit;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  button:hover { opacity: 0.88; }
  button:disabled { opacity: 0.5; cursor: default; }
  .foot { font-size: 11px; color: var(--muted); text-align: center; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><b>${APP_NAME}</b></div>
    <div>
      <h1>激活你的创作空间</h1>
      <p class="sub">输入购买时获得的激活码，解锁全部功能。</p>
    </div>
    <div class="field">
      <input id="code" placeholder="粘贴激活码" autocomplete="off" spellcheck="false" />
      <div class="err" id="err">激活码无效，请检查后重试</div>
    </div>
    <button id="btn">激活</button>
    <div class="foot">激活码与设备绑定，请勿分享或传播</div>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const input = document.getElementById("code");
    const btn = document.getElementById("btn");
    const err = document.getElementById("err");
    input.focus();
    async function submit() {
      const code = input.value.trim();
      if (!code) { err.style.display = "block"; err.textContent = "请输入激活码"; input.focus(); return; }
      btn.disabled = true;
      btn.textContent = "验证中…";
      const res = await ipcRenderer.invoke("license:activate", code);
      if (res && res.ok) {
        return; // 验证通过，主进程会关闭窗口
      }
      btn.disabled = false;
      btn.textContent = "激活";
      err.style.display = "block";
      err.textContent = (res && res.error) || "激活码无效，请检查后重试";
      input.select();
    }
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  </script>
</body>
</html>`;

/**
 * 启动时校验激活码。
 * 已激活 -> 直接返回 true（不弹窗）；
 * 未激活 -> 弹出激活窗口，等待用户输入；激活成功返回 true，用户关闭窗口返回 false。
 */
export function checkLicense(): Promise<boolean> {
  if (existsSync(licenseFile())) {
    if (isValid(readFileSync(licenseFile(), "utf8"))) return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let activated = false;
    const win = new BrowserWindow({
      width: 400,
      height: 500,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      title: `激活 ${APP_NAME}`,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });
    win.setMenuBarVisibility(false);

    ipcMain.handleOnce("license:activate", (_e, code: string) => {
      if (isValid(code)) {
        writeFileSync(licenseFile(), code.trim());
        activated = true;
        win.close();
        return { ok: true };
      }
      return { ok: false, error: "激活码无效，请检查后重试" };
    });

    win.on("closed", () => {
      resolve(activated);
    });

    void win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(ACTIVATION_HTML)}`,
    );
  });
}
