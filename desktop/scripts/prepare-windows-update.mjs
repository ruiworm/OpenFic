import { createHash } from "node:crypto";
import { access, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] ?? "dist-electron");
const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
const version = process.env.OPENFIC_UPDATE_VERSION ?? packageJson.version;
// 候选架构及其对应的旧版客户端别名。实际只处理「安装包确实存在」的那些：
// 打包矩阵可能只包含部分平台（例如仅 win-x86_64），若硬编码全量架构，
// readFile 找不到安装包会让本步骤失败，并连带 publish-release 不执行。
const candidates = [
  { architecture: "x86_64", legacy: "x64" },
  { architecture: "aarch64", legacy: "arm64" },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileInfo(fileName) {
  const filePath = path.join(outputDirectory, fileName);
  const contents = await readFile(filePath);
  const fileStats = await stat(filePath);
  return {
    fileName,
    sha512: createHash("sha512").update(contents).digest("base64"),
    size: fileStats.size,
  };
}

const universalInstaller = `NovelForge-${version}-win-setup.exe`;
for (const fileName of [universalInstaller, `${universalInstaller}.blockmap`]) {
  const filePath = path.join(outputDirectory, fileName);
  if (await exists(filePath)) await rm(filePath);
}

const selected = [];
for (const candidate of candidates) {
  const fileName = `NovelForge-${version}-win-${candidate.architecture}-setup.exe`;
  if (await exists(path.join(outputDirectory, fileName))) selected.push(candidate);
}
if (selected.length === 0) {
  throw new Error(`未找到任何 Windows 安装包（version=${version}，目录=${outputDirectory}）`);
}

const files = await Promise.all(
  selected.map(async (candidate) => ({
    architecture: candidate.architecture,
    legacy: candidate.legacy,
    ...(await getFileInfo(`NovelForge-${version}-win-${candidate.architecture}-setup.exe`)),
  })),
);
const releaseDate = new Date().toISOString();

function createUpdateInfo(file, compatibilityArchitecture) {
  const url = compatibilityArchitecture ? `${file.fileName}?arch=${compatibilityArchitecture}` : file.fileName;
  return [
    `version: ${version}`,
    "files:",
    `  - url: ${url}`,
    `    sha512: ${file.sha512}`,
    `    size: ${file.size}`,
    `path: ${url}`,
    `sha512: ${file.sha512}`,
    `releaseDate: '${releaseDate}'`,
    "",
  ].join("\n");
}

const legacyLatestYml = [
  `version: ${version}`,
  "files:",
  ...files.flatMap((file) => [
    `  - url: ${file.fileName}?arch=${file.legacy}`,
    `    sha512: ${file.sha512}`,
    `    size: ${file.size}`,
  ]),
  `path: ${files[0].fileName}?arch=${files[0].legacy}`,
  `sha512: ${files[0].sha512}`,
  `releaseDate: '${releaseDate}'`,
  "",
].join("\n");

await Promise.all([
  // Older clients select Windows assets by x64/arm64 substring; query aliases retain that compatibility.
  writeFile(path.join(outputDirectory, "latest.yml"), legacyLatestYml, "utf8"),
  ...files.map((file) => writeFile(path.join(outputDirectory, `latest-win-${file.architecture}.yml`), createUpdateInfo(file), "utf8")),
]);
