import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces, hostname, cpus, platform } from "node:os";

/**
 * 获取或生成当前物理设备的唯一硬件指纹。
 * 格式示例：NF-A1B2-C3D4-E5F6
 */
let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  const rawParts: string[] = [];
  const osType = platform();

  try {
    if (osType === "linux") {
      for (const idPath of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (existsSync(idPath)) {
          rawParts.push(readFileSync(idPath, "utf8").trim());
          break;
        }
      }
    } else if (osType === "win32") {
      try {
        const out = execSync(
          'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
          { timeout: 3000, encoding: "utf8", windowsHide: true },
        );
        const match = out.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/);
        if (match) rawParts.push(match[1]);
      } catch {
        // Fallback for Windows without registry access
      }
    } else if (osType === "darwin") {
      try {
        const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
          timeout: 3000,
          encoding: "utf8",
        });
        const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match) rawParts.push(match[1]);
      } catch {
        // Fallback for macOS
      }
    }
  } catch {
    // ignore system command errors
  }

  // 补充 CPU 及主板/主机名特征以确保唯一性与稳定性
  try {
    rawParts.push(hostname());
    const cpuInfo = cpus();
    if (cpuInfo && cpuInfo.length > 0) {
      rawParts.push(cpuInfo[0].model);
    }
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
          rawParts.push(net.mac);
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  const rawString = rawParts.filter(Boolean).join("|") || "NovelForge-Fallback-Node";
  const hash = createHash("sha256").update(rawString).digest("hex").toUpperCase();
  // 截取前 12 位分 3 组
  const p1 = hash.slice(0, 4);
  const p2 = hash.slice(4, 8);
  const p3 = hash.slice(8, 12);
  cachedDeviceId = `NF-${p1}-${p2}-${p3}`;
  return cachedDeviceId;
}
