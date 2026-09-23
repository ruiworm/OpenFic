import type { StartupProgressEvent } from "../../shared/ipc";
import { useTranslation } from "react-i18next";

function formatReduced(value: number): string {
  return value.toFixed(1);
}

const MAX_PROGRESS_DETAIL_LENGTH = 72;
const CJK_PATTERN = /[\u4e00-\u9fff]/;

/**
 * 主进程上报的明细里混着命令原文、超长路径和 uv 的英文日志，挑出对用户有意义、
 * 且能体现「确实在动」的那一行；没把握的一律不显示，宁可只留步骤文案。
 */
function describeProgressDetail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line || line.length > MAX_PROGRESS_DETAIL_LENGTH) return null;
  if (/^(执行命令|检查命令|检查 Python 版本)[:：]/.test(line)) return null;
  return line;
}

function composeProgressMessage(stepMessage: string, detail: string | null): string {
  if (!detail) return stepMessage;
  // 明细本身已是中文（如「下载 Python 3.13.14」「正在下载 Python · 42%」）时直接替换步骤文案，
  // 避免出现「正在更新 Python 运行环境 · 正在下载 Python · 42%」这种叠词。
  return CJK_PATTERN.test(detail) ? detail : `${stepMessage} · ${detail}`;
}

function renderMaintenanceDetail(
  message: string,
  ...details: Array<string | null>
): string {
  const parts = [message, ...details.filter((detail): detail is string => detail !== null)];
  return parts.join(" · ");
}

interface StartupProgressProps {
  progress: StartupProgressEvent | null;
  bare?: boolean;
}

const STARTUP_MESSAGE_KEYS: Record<StartupProgressEvent["step"], string> = {
  "load-config": "desktop.startup.loadConfigMessage",
  "check-runtime": "desktop.startup.checkRuntimeMessage",
  "update-python": "desktop.startup.updatePythonMessage",
  "update-openfic": "desktop.startup.updateOpenFicMessage",
  "start-backend": "desktop.startup.startBackendProcessMessage",
  "initialize-backend": "desktop.startup.initializeBackendMessage",
  "initialize-database": "desktop.startup.initializeDatabaseMessage",
  "complete-backend-startup": "desktop.startup.completeBackendStartupMessage",
  "check-health": "desktop.startup.verifyServiceMessage",
  "maintain-database": "desktop.startup.databaseMaintenanceMessage",
  "connect-remote": "desktop.startup.connectServiceMessage",
  "verify-remote": "desktop.startup.verifyServiceMessage",
  "check-compatibility": "desktop.startup.checkCompatibilityMessage",
  ready: "desktop.startup.serviceReadyMessage",
};

const MAINTENANCE_MESSAGE_KEYS: Record<NonNullable<StartupProgressEvent["maintenancePhase"]>, string> = {
  pending: "desktop.startup.databaseMaintenanceMessage",
  pruning: "desktop.startup.databasePruningMessage",
  migrating: "desktop.startup.databaseMigrationMessage",
  vacuuming: "desktop.startup.databaseVacuumMessage",
  cleanup: "desktop.startup.databaseCleanupMessage",
  ready: "desktop.startup.serviceReadyMessage",
  failed: "desktop.startup.databaseMaintenanceFailedMessage",
};

export function StartupProgress({ progress, bare = false }: StartupProgressProps) {
  const { t } = useTranslation();
  const indeterminate = progress?.indeterminate ?? false;
  const value = Math.round((progress?.progress ?? 0) * 100);
  const title = progress ? t("desktop.startup.startBackendTitle") : t("desktop.startup.preparingApp");
  const stepMessage = progress
    ? progress.maintenancePhase
      ? t(MAINTENANCE_MESSAGE_KEYS[progress.maintenancePhase])
      : t(STARTUP_MESSAGE_KEYS[progress.step])
    : t("desktop.startup.initializingService");
  // 安装依赖这类步骤会持续好几分钟。此前只显示固定的步骤文案，进度条停在某处不动，
  // 看起来就像卡死了，实际一直在下载。把主进程上报的实时明细显示出来。
  const detail = progress?.maintenancePhase ? null : describeProgressDetail(progress?.message);
  const message = composeProgressMessage(stepMessage, detail);
  const maintenanceDetail =
    progress?.maintenanceProgress != null
      ? `${Math.round(Math.min(1, Math.max(0, progress.maintenanceProgress)) * 100)}%`
      : null;
  const sizeDetail =
    progress?.maintenanceReclaimedBytes != null &&
    progress?.maintenanceTotalBytes != null &&
    progress.maintenanceTotalBytes > 0
      ? `${formatReduced(progress.maintenanceReclaimedBytes / (1024 ** 3))}/${formatReduced(
          progress.maintenanceTotalBytes / 1024 ** 3,
        )}GB`
      : null;
  const vmOpsDetail =
    progress?.maintenanceVmOps != null
      ? `${progress.maintenanceVmOps.toLocaleString()} VM ops`
      : null;
  const elapsedDetail =
    progress?.maintenanceElapsedSeconds != null
      ? `${formatReduced(progress.maintenanceElapsedSeconds)}s`
      : null;
  const slowHint =
    progress?.maintenancePhase === "migrating" || progress?.maintenancePhase === "vacuuming"
      ? t("desktop.startup.databaseMaintenanceSlowHint")
      : null;

  return (
    <section
      className="startup-progress"
      data-bare={bare}
      data-status={progress?.status ?? "running"}
      aria-live="polite"
    >
      <div className="startup-progress-heading">
        <strong>{title}</strong>
        <span>{indeterminate ? "…" : `${value}%`}</span>
      </div>
      <div
        className="startup-progress-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : value}
        data-indeterminate={indeterminate}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      <p>
        {renderMaintenanceDetail(message, sizeDetail, vmOpsDetail, elapsedDetail, maintenanceDetail, slowHint)}
      </p>
    </section>
  );
}
