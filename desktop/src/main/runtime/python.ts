import { app } from "electron";
import { spawn } from "node:child_process";
import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { appendLog } from "../logging.js";
import { downloadFile, extractTarGz } from "./archive.js";
import { resolvePythonAsset } from "./python-assets.js";
import { matchesPortablePythonVersion } from "./python-version.js";

export interface PortablePython {
  pythonPath: string;
  rootDir: string;
  wasReplaced: boolean;
}

export interface DownloadProgress {
  received: number;
  total: number;
}

export interface RuntimeIntegrityCheck {
  complete: boolean;
  message: string;
}

export function getDefaultInstallDir(): string {
  return app.getPath("userData");
}

export function resolveRuntimeDir(installDir: string | null): string {
  const base = installDir ?? app.getPath("userData");
  return path.join(base, "runtime");
}

export function getPortablePythonRoot(runtimeDir: string): string {
  return path.join(runtimeDir, "python");
}

export function getPortablePythonPath(rootDir: string): string {
  if (process.platform === "win32") return path.join(rootDir, "python", "python.exe");
  return path.join(rootDir, "python", "bin", "python3");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const value = bytes / Math.pow(1024, Math.floor(Math.log(bytes) / Math.log(1024)));
  const unit = units[Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)];
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

function readPythonVersion(pythonPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    appendLog("runtime", `检查 Python 版本：${pythonPath} --version`);
    const child = spawn(pythonPath, ["--version"], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const appendOutput = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      output += text;
      appendLog("runtime", text);
    };
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.on("error", (error) => {
      appendLog("runtime", `检查 Python 版本失败：${error.message}`);
      resolve(null);
    });
    // 必须等 close 而不是 exit：Windows 上 exit 触发时 stdout 仍可能未排空，
    // 此时读取 output 会得到空串，被误判成「版本不匹配」并删掉可用的运行时。
    child.on("close", (code) => {
      appendLog("runtime", code === 0 ? "检查 Python 版本完成" : `检查 Python 版本失败：退出码 ${code}`);
      resolve(code === 0 ? output.trim() || null : null);
    });
  });
}

export async function inspectPortablePython(runtimeDir: string): Promise<RuntimeIntegrityCheck> {
  const pythonPath = getPortablePythonPath(getPortablePythonRoot(runtimeDir));
  if (!(await pathExists(pythonPath))) {
    return { complete: false, message: "未找到便携式 Python" };
  }

  const installedVersion = await readPythonVersion(pythonPath);
  if (!installedVersion || !matchesPortablePythonVersion(installedVersion, resolvePythonAsset().version)) {
    return { complete: false, message: "便携式 Python 不可用或版本不匹配" };
  }

  return { complete: true, message: "便携式 Python 已就绪" };
}

const VERSION_PROBE_ATTEMPTS = 2;
const VERSION_PROBE_RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 读取便携式 Python 版本，读不到时重试一次。
 * 单次探测偶发返回空（进程刚被创建、杀软首次扫描拦截等）不代表运行时真的坏了，
 * 必须重试后才允许判定「不可用」，否则会误删可用的运行时并触发整轮重装。
 */
async function probePythonVersion(pythonPath: string): Promise<string | null> {
  for (let attempt = 1; attempt <= VERSION_PROBE_ATTEMPTS; attempt += 1) {
    const version = await readPythonVersion(pythonPath);
    if (version) return version;
    if (attempt < VERSION_PROBE_ATTEMPTS) {
      appendLog("runtime", `未读到 Python 版本，${VERSION_PROBE_RETRY_DELAY_MS}ms 后重试`);
      await delay(VERSION_PROBE_RETRY_DELAY_MS);
    }
  }
  return null;
}

export async function ensurePortablePython(
  runtimeDir: string,
  onPhase: (phase: "download" | "extract", message: string) => void,
  onDownload: (progress: DownloadProgress) => void,
): Promise<PortablePython> {
  const rootDir = getPortablePythonRoot(runtimeDir);
  const pythonPath = getPortablePythonPath(rootDir);
  const asset = resolvePythonAsset();
  appendLog("runtime", `开始检查便携式 Python：${rootDir}`);
  const hadExistingRuntime = await pathExists(pythonPath);
  if (hadExistingRuntime) {
    const installedVersion = await probePythonVersion(pythonPath);
    if (installedVersion && matchesPortablePythonVersion(installedVersion, asset.version)) {
      appendLog("runtime", `便携式 Python 已就绪：${installedVersion}`);
      return { pythonPath, rootDir, wasReplaced: false };
    }
    appendLog(
      "runtime",
      installedVersion
        ? `便携式 Python 版本不匹配：${installedVersion} != ${asset.version}，准备重新安装`
        : "便携式 Python 不可用，准备重新安装",
    );
  }

  // 注意：这里不再提前删除 rootDir。旧实现「先删后下」，一旦下载/解压失败，
  // 原本可用的运行时已经被清空，整个应用再也起不来（必须联网重试才能恢复）。
  // 解压本身走 staging 目录 + 逐项复制 + 回滚，无需先清空目标目录。
  const archivePath = path.join(runtimeDir, `python-${asset.version}-${asset.target}.tar.gz`);
  await mkdir(runtimeDir, { recursive: true });

  try {
    onPhase("download", `下载 Python ${asset.version}`);
    appendLog("runtime", `开始下载 Python ${asset.version}`);
    await downloadFile(
      asset.urls,
      archivePath,
      (received, total) => onDownload({ received, total }),
      (message) => appendLog("runtime", message),
    );

    onPhase("extract", "解压 Python");
    appendLog("runtime", "开始解压 Python");
    await extractTarGz(archivePath, rootDir, (message) => appendLog("runtime", message), undefined, false);

    if (!(await pathExists(pythonPath))) {
      throw new Error(`portable Python not found after extraction: ${pythonPath}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // 更新失败不必然是致命错误：若原有的便携式 Python 仍然能跑，就沿用它。
    // 让用户带着一个可用（哪怕是旧版本）的运行时启动，远好过直接卡在启动页。
    if (hadExistingRuntime && (await pathExists(pythonPath))) {
      const fallbackVersion = await probePythonVersion(pythonPath);
      if (fallbackVersion) {
        appendLog(
          "runtime",
          `Python 更新失败，沿用现有运行时 ${fallbackVersion}，继续启动：${detail}`,
        );
        return { pythonPath, rootDir, wasReplaced: false };
      }
    }
    throw error;
  } finally {
    await rm(archivePath, { force: true });
  }

  appendLog("runtime", "便携式 Python 安装完成");
  return { pythonPath, rootDir, wasReplaced: true };
}

export function describeDownloadProgress(progress: DownloadProgress): string {
  if (!progress.total) return formatBytes(progress.received);
  return `${formatBytes(progress.received)} / ${formatBytes(progress.total)}`;
}
