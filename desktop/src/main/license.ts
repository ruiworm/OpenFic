import { app, BrowserWindow, ipcMain } from "electron";
import { createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDeviceId } from "./device-id.js";

// ============ 软件授权配置 ============
const APP_NAME = "NovelForge"; // 软件定制品牌名
const PREFIX = "NOVELFORGE"; // 激活码前缀，需与 scripts/gen_license.py 保持一致
// =====================================

// 受信任公钥列表：包含原有公钥及新生成的商业公钥
const TRUSTED_PUBLIC_KEYS = [
  // 原有公钥
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAH4U61cLc/taoDOUNS71bOpLpIaFyibPUSKwMfJ+ZE10=
-----END PUBLIC KEY-----`,
  // 配套生成器公钥
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAK4zX1nXdKKs1vq8afAJ/H7kFKQ1rszFwHCqn9bSohnY=
-----END PUBLIC KEY-----`,
];

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64url");
}

export interface LicenseVerifyResult {
  valid: boolean;
  error?: string;
  orderId?: string;
  deviceId?: string;
  expiresAt?: number | null;
}

/**
 * 校验激活码：
 * 1. 支持 V2 格式：NOVELFORGE.V2.<Base64(Payload)>.<Base64(Signature)>
 *    进行设备指纹绑定校验与有效期检查；
 * 2. 兼容 V1 格式：NOVELFORGE.<Base64(OrderId)>.<Base64(Signature)>
 */
export function verifyLicense(code: string): LicenseVerifyResult {
  const trimmed = code.trim();

  // 1. 尝试匹配 V2 商业授权码
  const mV2 = trimmed.match(new RegExp(`^${PREFIX}\\.V2\\.([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`));
  if (mV2) {
    try {
      const payloadBuf = b64urlDecode(mV2[1]);
      const sig = b64urlDecode(mV2[2]);

      let sigOk = false;
      for (const pem of TRUSTED_PUBLIC_KEYS) {
        try {
          const pub = createPublicKey(pem);
          if (verify(null, payloadBuf, pub, sig)) {
            sigOk = true;
            break;
          }
        } catch {
          // try next public key
        }
      }

      if (!sigOk) {
        return { valid: false, error: "激活码签名无效，请检查激活码是否完整" };
      }

      const payload = JSON.parse(payloadBuf.toString("utf8"));
      const currentDeviceId = getDeviceId();

      // 检查设备指纹绑定
      if (
        payload.deviceId &&
        payload.deviceId !== "*" &&
        payload.deviceId.toUpperCase() !== currentDeviceId.toUpperCase()
      ) {
        return {
          valid: false,
          error: `激活码绑定的设备不匹配（本机设备码：${currentDeviceId}）`,
        };
      }

      // 检查授权有效期
      if (payload.expiresAt && typeof payload.expiresAt === "number") {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > payload.expiresAt) {
          const expireDate = new Date(payload.expiresAt * 1000).toLocaleDateString("zh-CN");
          return {
            valid: false,
            error: `激活码已于 ${expireDate} 过期，请续费后重试`,
          };
        }
      }

      return {
        valid: true,
        orderId: payload.orderId,
        deviceId: payload.deviceId,
        expiresAt: payload.expiresAt,
      };
    } catch {
      return { valid: false, error: "激活码载荷解析失败，格式异常" };
    }
  }

  // 2. 尝试兼容匹配旧版 V1 激活码
  const mV1 = trimmed.match(new RegExp(`^${PREFIX}\\.([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`));
  if (mV1) {
    try {
      const orderIdBuf = b64urlDecode(mV1[1]);
      const sig = b64urlDecode(mV1[2]);

      for (const pem of TRUSTED_PUBLIC_KEYS) {
        try {
          const pub = createPublicKey(pem);
          if (verify(null, orderIdBuf, pub, sig)) {
            return { valid: true, orderId: orderIdBuf.toString("utf8") };
          }
        } catch {
          // try next public key
        }
      }
      return { valid: false, error: "激活码签名验证失败" };
    } catch {
      return { valid: false, error: "激活码格式解析失败" };
    }
  }

  return { valid: false, error: "激活码格式不正确" };
}

function isValid(code: string): boolean {
  return verifyLicense(code).valid;
}

function licenseFile(): string {
  return join(app.getPath("userData"), "license.txt");
}

// 激活窗口 HTML，风格对齐 NovelForge：黑白灰、圆角 10px、衬线字体
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
  .card { width: 336px; display: flex; flex-direction: column; gap: 16px; }
  .brand { font-size: 15px; letter-spacing: 0.3px; }
  .brand b { font-weight: 600; }
  h1 { font-size: 21px; font-weight: 500; letter-spacing: 0.5px; line-height: 1.3; }
  .sub { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .device-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f5f5f5;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 8px 12px;
    font-size: 12px;
  }
  .dev-code {
    font-family: "JetBrains Mono", monospace;
    font-weight: 600;
    color: #444;
  }
  .copy-btn {
    border: none;
    background: transparent;
    color: #1677ff;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
  }
  .copy-btn:hover { background: #e6f4ff; }
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
  .err { font-size: 12px; color: #d13438; display: none; line-height: 1.4; }
  button.submit {
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
  button.submit:hover { opacity: 0.88; }
  button.submit:disabled { opacity: 0.5; cursor: default; }
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
    <div class="device-box">
      <div>
        <span style="color: var(--muted);">设备码：</span>
        <span class="dev-code" id="devCode">读取中...</span>
      </div>
      <button type="button" class="copy-btn" id="copyBtn">复制</button>
    </div>
    <div class="field">
      <input id="code" placeholder="粘贴激活码" autocomplete="off" spellcheck="false" />
      <div class="err" id="err">激活码无效，请检查后重试</div>
    </div>
    <button class="submit" id="btn">激活</button>
    <div class="foot">支持一机一码设备绑定与期限控制，请妥善保管</div>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const input = document.getElementById("code");
    const btn = document.getElementById("btn");
    const err = document.getElementById("err");
    const devCode = document.getElementById("devCode");
    const copyBtn = document.getElementById("copyBtn");

    ipcRenderer.invoke("license:get-device-id").then((id) => {
      if (id) devCode.textContent = id;
    });

    copyBtn.addEventListener("click", () => {
      const text = devCode.textContent;
      if (text && text !== "读取中...") {
        navigator.clipboard.writeText(text);
        copyBtn.textContent = "已复制";
        setTimeout(() => { copyBtn.textContent = "复制"; }, 2000);
      }
    });

    input.focus();
    async function submit() {
      const code = input.value.trim();
      if (!code) { err.style.display = "block"; err.textContent = "请输入激活码"; input.focus(); return; }
      btn.disabled = true;
      btn.textContent = "验证中…";
      const res = await ipcRenderer.invoke("license:activate", code);
      if (res && res.ok) {
        btn.textContent = "激活成功";
        btn.disabled = true;
        return;
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

let activationWin: BrowserWindow | null = null;

/** 主窗口打开后，由 main.ts 调用此函数关闭激活窗口 */
export function closeActivationWindow(): void {
  if (activationWin && !activationWin.isDestroyed()) {
    activationWin.close();
  }
  activationWin = null;
}

export function checkLicense(): Promise<boolean> {
  if (existsSync(licenseFile())) {
    if (isValid(readFileSync(licenseFile(), "utf8"))) return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const win = new BrowserWindow({
      width: 420,
      height: 520,
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
    activationWin = win;
    win.setMenuBarVisibility(false);

    const handleActivate = (_e: unknown, code: string) => {
      const result = verifyLicense(code);
      if (result.valid) {
        writeFileSync(licenseFile(), code.trim());
        resolved = true;
        resolve(true);
        return { ok: true };
      }
      return { ok: false, error: result.error || "激活码无效，请检查后重试" };
    };

    const handleGetDeviceId = () => {
      return getDeviceId();
    };

    ipcMain.handle("license:activate", handleActivate);
    ipcMain.handle("license:get-device-id", handleGetDeviceId);

    win.on("closed", () => {
      ipcMain.removeHandler("license:activate");
      ipcMain.removeHandler("license:get-device-id");
      if (activationWin === win) activationWin = null;
      if (!resolved) resolve(false);
    });

    void win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(ACTIVATION_HTML)}`,
    );
  });
}
