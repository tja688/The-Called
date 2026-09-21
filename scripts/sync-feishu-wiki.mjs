#!/usr/bin/env node
/**
 * 飞书知识库 → 本地 docs 全量同步（飞书为唯一真源）
 *
 * 用法（仓库根目录）：
 *   node scripts/sync-feishu-wiki.mjs
 *   npm run sync:feishu-docs
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const INVALID_WIN_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

function loadConfig() {
  const configPath = path.join(__dirname, 'sync-feishu-wiki.config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    ...raw,
    targetDir: path.resolve(REPO_ROOT, raw.targetDir),
    changelogFile: path.resolve(REPO_ROOT, raw.changelogFile),
    preserveRelPaths: new Set(raw.preserveRelPaths ?? []),
  };
}

function sanitizeSegment(name) {
  return name.replace(INVALID_WIN_CHARS, '-').replace(/\s+/g, ' ').trim() || '_';
}

function parseLarkJson(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) {
    throw new Error(`lark-cli 输出中无 JSON：${stdout.slice(0, 200)}`);
  }
  return JSON.parse(stdout.slice(start));
}

/** Windows 下需 shell 才能解析 lark-cli；含空格的 flag 值必须加引号 */
function quoteForShell(arg) {
  if (!/[\s"]/u.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function runLark(args, { cwd = REPO_ROOT } = {}) {
  const useShell = process.platform === 'win32';
  const result = useShell
    ? spawnSync(`lark-cli ${args.map(quoteForShell).join(' ')}`, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      })
    : spawnSync('lark-cli', args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (result.status !== 0) {
    let message = stderr || stdout;
    try {
      const errJson = parseLarkJson(stdout || stderr);
      message = errJson.error?.message ?? message;
    } catch {
      /* keep raw */
    }
    throw new Error(`lark-cli ${args.join(' ')} 失败 (exit ${result.status}): ${message}`);
  }
  return parseLarkJson(stdout);
}

function listWikiNodes(spaceId, parentNodeToken, larkAs) {
  const args = [
    'wiki',
    '+node-list',
    '--space-id',
    spaceId,
    '--as',
    larkAs,
    '--page-all',
    '--page-limit',
    '0',
    '--format',
    'json',
  ];
  if (parentNodeToken) {
    args.push('--parent-node-token', parentNodeToken);
  }
  const json = runLark(args);
  return json.data?.nodes ?? [];
}

/** @typedef {{ titlePath: string[], node_token: string, obj_type: string, title: string }} WikiLeaf */

function walkWiki(spaceId, larkAs) {
  /** @type {WikiLeaf[]} */
  const nodes = [];

  function visit(parentToken, titlePath) {
    const children = listWikiNodes(spaceId, parentToken || undefined, larkAs);
    for (const node of children) {
      const segment = sanitizeSegment(node.title);
      const nextPath = [...titlePath, segment];
      nodes.push({
        titlePath: nextPath,
        node_token: node.node_token,
        obj_type: node.obj_type,
        title: node.title,
      });
      if (node.has_child) {
        visit(node.node_token, nextPath);
      }
    }
  }

  visit('', []);
  return nodes;
}

function relPathForNode(titlePath, objType) {
  if (titlePath.length === 0) throw new Error('空路径');
  const fileName = titlePath[titlePath.length - 1];
  if (objType === 'docx') {
    const dirParts = titlePath.slice(0, -1);
    return path.join(...dirParts, `${fileName}.md`).split(path.sep).join('/');
  }
  // 其他类型保留扩展名由下载/导出结果决定；默认用标题作 basename
  const dirParts = titlePath.slice(0, -1);
  return path.join(...dirParts, fileName).split(path.sep).join('/');
}

function hashFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return createHash('sha256').update(buf).digest('hex');
}

function listLocalFiles(targetDir, preserveRelPaths) {
  /** @type {Map<string, string>} relPath -> sha256 */
  const map = new Map();
  if (!fs.existsSync(targetDir)) return map;

  function walk(dir, relPrefix) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!name.isFile()) continue;
      const rel = relPrefix ? `${relPrefix}/${name.name}` : name.name;
      if (preserveRelPaths.has(rel.replace(/\\/g, '/'))) continue;
      const abs = path.join(dir, name.name);
      map.set(rel.replace(/\\/g, '/'), hashFile(abs));
    }
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const rel = relPrefix ? `${relPrefix}/${name.name}` : name.name;
      walk(path.join(dir, name.name), rel);
    }
  }

  walk(targetDir, '');
  return map;
}

function exportDocx(nodeToken, outputDir, fileBaseName, larkAs) {
  fs.mkdirSync(outputDir, { recursive: true });
  const url = `https://feishu.cn/wiki/${nodeToken}`;
  const json = runLark([
    'drive',
    '+export',
    '--url',
    url,
    '--file-extension',
    'markdown',
    '--as',
    larkAs,
    '--output-dir',
    path.relative(REPO_ROOT, outputDir) || '.',
    '--file-name',
    fileBaseName,
    '--overwrite',
    '--format',
    'json',
  ]);
  const saved = json.data?.saved_path;
  if (!saved) {
    throw new Error(`导出未返回 saved_path: ${nodeToken}`);
  }
  return path.resolve(saved);
}

function downloadFileNode(nodeToken, outputAbsPath, larkAs) {
  fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
  const url = `https://feishu.cn/wiki/${nodeToken}`;
  runLark([
    'drive',
    '+download',
    '--url',
    url,
    '--as',
    larkAs,
    '--output',
    path.relative(REPO_ROOT, outputAbsPath),
    '--overwrite',
    '--format',
    'json',
  ]);
  return outputAbsPath;
}

function exportOtherDoc(nodeToken, objType, outputDir, fileBaseName, larkAs) {
  const extMap = {
    sheet: 'xlsx',
    bitable: 'base',
    slides: 'pptx',
  };
  const ext = extMap[objType];
  if (!ext) {
    throw new Error(`暂不支持的 obj_type: ${objType} (${nodeToken})`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const url = `https://feishu.cn/wiki/${nodeToken}`;
  const json = runLark([
    'drive',
    '+export',
    '--url',
    url,
    '--file-extension',
    ext,
    '--as',
    larkAs,
    '--output-dir',
    path.relative(REPO_ROOT, outputDir) || '.',
    '--file-name',
    fileBaseName,
    '--overwrite',
    '--format',
    'json',
  ]);
  return path.resolve(json.data.saved_path);
}

function syncNodeToDisk(node, targetDir, larkAs) {
  const rel = relPathForNode(node.titlePath, node.obj_type);
  const abs =
    node.obj_type === 'docx'
      ? path.join(targetDir, ...rel.split('/'))
      : path.join(targetDir, ...rel.split('/'));

  if (node.obj_type === 'docx') {
    const dir = path.dirname(abs);
    const base = path.basename(abs, '.md');
    exportDocx(node.node_token, dir, base, larkAs);
    return rel;
  }

  if (node.obj_type === 'file') {
    downloadFileNode(node.node_token, abs, larkAs);
    return rel.replace(/\\/g, '/');
  }

  const dir = path.dirname(abs);
  const base = path.basename(abs);
  exportOtherDoc(node.node_token, node.obj_type, dir, base, larkAs);
  const savedRel = path.relative(targetDir, path.join(dir, base)).split(path.sep).join('/');
  return savedRel;
}

function removeEmptyDirs(dir, root) {
  if (!fs.existsSync(dir) || dir === root) return;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      removeEmptyDirs(path.join(dir, name.name), root);
    }
  }
  if (dir !== root && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function appendChangelog(changelogFile, section) {
  fs.mkdirSync(path.dirname(changelogFile), { recursive: true });
  const header = '# 飞书知识库同步差异记录\n\n> 由 `scripts/sync-feishu-wiki.mjs` 维护。飞书知识库为唯一真源；本节以下为历次同步快照。\n\n';
  if (!fs.existsSync(changelogFile)) {
    fs.writeFileSync(changelogFile, header, 'utf8');
  }
  fs.appendFileSync(changelogFile, section, 'utf8');
}

function formatSection({
  now,
  spaceName,
  spaceId,
  added,
  removed,
  modified,
  unchangedCount,
  errors,
}) {
  const lines = [
    `## ${now}\n`,
    `- 知识库：**${spaceName}**（\`space_id=${spaceId}\`）`,
    '- 策略：全量同步（本地多余文件已删除）',
    `- 统计：新增 ${added.length} · 删除 ${removed.length} · 内容变更 ${modified.length} · 未变 ${unchangedCount}`,
    '',
  ];
  if (errors.length) {
    lines.push('### 失败', ...errors.map((e) => `- ${e}`), '');
  }
  lines.push('### 新增');
  if (added.length) lines.push(...added.map((p) => `- \`${p}\``));
  else lines.push('- （无）');
  lines.push('', '### 删除');
  if (removed.length) lines.push(...removed.map((p) => `- \`${p}\``));
  else lines.push('- （无）');
  lines.push('', '### 内容变更');
  if (modified.length) lines.push(...modified.map((p) => `- \`${p}\``));
  else lines.push('- （无）');
  lines.push('', '---\n', '');
  return lines.join('\n');
}

function main() {
  const config = loadConfig();
  const { spaceId, spaceName, targetDir, changelogFile, preserveRelPaths, larkAs } = config;

  console.log(`同步：${spaceName} → ${path.relative(REPO_ROOT, targetDir)}`);

  const before = listLocalFiles(targetDir, preserveRelPaths);
  const wikiNodes = walkWiki(spaceId, larkAs);

  /** @type {Map<string, WikiLeaf>} */
  const relToNode = new Map();
  for (const node of wikiNodes) {
    const rel = relPathForNode(node.titlePath, node.obj_type);
    if (relToNode.has(rel)) {
      throw new Error(`路径冲突：${rel}（${node.title}）`);
    }
    relToNode.set(rel, node);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  /** @type {Map<string, string>} */
  const after = new Map();
  /** @type {string[]} */
  const errors = [];

  for (const [rel, node] of relToNode) {
    try {
      process.stdout.write(`导出 ${rel} … `);
      const writtenRel = syncNodeToDisk(node, targetDir, larkAs);
      const abs = path.join(targetDir, ...writtenRel.split('/'));
      after.set(writtenRel.replace(/\\/g, '/'), hashFile(abs));
      console.log('ok');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('失败');
      errors.push(`\`${rel}\`：${msg}`);
    }
  }

  const beforePaths = new Set(before.keys());
  const afterPaths = new Set(after.keys());

  const added = [...afterPaths].filter((p) => !beforePaths.has(p)).sort();
  const removed = [...beforePaths].filter((p) => !afterPaths.has(p)).sort();
  const modified = [...afterPaths]
    .filter((p) => beforePaths.has(p) && before.get(p) !== after.get(p))
    .sort();
  const unchangedCount = [...afterPaths].filter(
    (p) => beforePaths.has(p) && before.get(p) === after.get(p),
  ).length;

  for (const rel of removed) {
    const abs = path.join(targetDir, ...rel.split('/'));
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      console.log(`删除 ${rel}`);
    }
  }
  removeEmptyDirs(targetDir, targetDir);

  const now = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', 'T');
  const nowLabel = `${now}+08:00`;
  const section = formatSection({
    now: nowLabel,
    spaceName,
    spaceId,
    added,
    removed,
    modified,
    unchangedCount,
    errors,
  });
  appendChangelog(changelogFile, section);

  console.log('\n完成。差异已写入：', path.relative(REPO_ROOT, changelogFile));
  if (errors.length) {
    process.exitCode = 1;
  }
}

main();
