// supadevops — supa-starter 模板的确定性重命名引擎（零依赖 Node）。
//
// 由 /supa-init 在 degit 取得模板后调用：将固定占位名
//   app/next-app, app/expo-app, app/gas-app, package/core(@app/core)
// 按用户项目名重命名（目录名 + 文件内 token + app.json 标识）。
// 不执行 npm install（由调用方负责）。重命名是机械的、无歧义的、可重复的。
//
// 用法:
//   node rename-starter.mjs <dest> --next <name> --expo <name> --gas <name> --lib <slug>
//
// 退出码: 0=成功 / 1=参数或校验失败 / 2=仍有残留占位 token（异常）。

import { readFileSync, writeFileSync, renameSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';

/** 占位名（与 supa-starter 模板一致，刻意以 `-app` 结尾 / 带 `@app/` scope 以避免子串误伤）。 */
const PLACEHOLDER = { next: 'next-app', expo: 'expo-app', gas: 'gas-app', libSlug: 'core', libName: '@app/core' };

/** 不进入的目录。 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.expo', '.turbo', 'ios', 'android', '.vscode']);

/** 视为二进制、跳过文本替换的扩展名。 */
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.icns', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.zip', '.keystore',
]);

// 注意：package-lock.json 也参与 token 替换 —— 外部依赖名都不含 next-app / expo-app / @app/core
// 这些整词，故只会改写 workspace 自身的路径/名称项，从而保留所有外部依赖的精确锁定版本（决定论），
// 重命名后可用 `npm ci` 严格按锁文件安装。
/** 不做文本替换的具体文件名。 */
const SKIP_FILES = new Set();

/**
 * 解析 CLI 参数。
 * @param {string[]} argv
 * @returns {{ dest: string, next: string, expo: string, gas: string, lib: string }}
 */
function parseArgs(argv) {
  const positional = [];
  const opt = /** @type {Record<string, string>} */ ({});
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      opt[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { dest: positional[0], next: opt.next, expo: opt.expo, gas: opt.gas, lib: opt.lib };
}

/**
 * 校验项目 / 库名（npm 名与目录名安全）。
 * @param {string} name
 * @param {string} label
 * @returns {string}
 */
function requireName(name, label) {
  if (!name) fail(`缺少 ${label}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail(`${label} 非法（仅允许小写字母/数字/连字符，且不以连字符开头）: ${name}`);
  if ([PLACEHOLDER.next, PLACEHOLDER.expo, PLACEHOLDER.gas, PLACEHOLDER.libSlug].includes(name)) {
    fail(`${label} 不能等于占位名（next-app/expo-app/gas-app/core）: ${name}`);
  }
  return name;
}

/**
 * 输出错误并以码 1 退出。
 * @param {string} msg
 * @returns {never}
 */
function fail(msg) {
  console.error(`rename-starter: ${msg}`);
  process.exit(1);
}

/**
 * 递归遍历目录，对每个文件调用 cb（跳过 SKIP_DIRS）。
 * @param {string} dir
 * @param {(filePath: string) => void} cb
 */
function walk(dir, cb) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(p, cb);
    } else if (st.isFile()) {
      cb(p);
    }
  }
}

/**
 * 对单个文本文件应用 token 替换；返回是否有改动。
 * @param {string} filePath
 * @param {Array<[RegExp, string]>} rules
 * @returns {boolean}
 */
function replaceInFile(filePath, rules) {
  const before = readFileSync(filePath, 'utf8');
  let after = before;
  for (const [re, to] of rules) after = after.replace(re, to);
  if (after !== before) {
    writeFileSync(filePath, after);
    return true;
  }
  return false;
}

function main() {
  const { dest, next, expo, gas, lib } = parseArgs(process.argv.slice(2));
  if (!dest) fail('用法: node rename-starter.mjs <dest> --next <name> --expo <name> --gas <name> --lib <slug>');
  if (!existsSync(dest)) fail(`目标目录不存在: ${dest}`);
  const NEXT = requireName(next, '--next');
  const EXPO = requireName(expo, '--expo');
  const GAS = requireName(gas, '--gas');
  const LIB = requireName(lib, '--lib');
  if (new Set([NEXT, EXPO, GAS, LIB]).size !== 4) fail('--next / --expo / --gas / --lib 不能重复');

  // 1) 目录重命名（先于内容替换，使路径最终化）。
  const renames = [
    [join(dest, 'app', PLACEHOLDER.next), join(dest, 'app', NEXT)],
    [join(dest, 'app', PLACEHOLDER.expo), join(dest, 'app', EXPO)],
    [join(dest, 'app', PLACEHOLDER.gas), join(dest, 'app', GAS)],
    [join(dest, 'package', PLACEHOLDER.libSlug), join(dest, 'package', LIB)],
  ];
  for (const [from, to] of renames) {
    if (!existsSync(from)) fail(`未找到模板占位目录: ${from}（degit 取得是否正确？）`);
    renameSync(from, to);
  }

  // 2) 文件内 token 替换。@app/core 先于裸 token；裸 core 永不替换。
  /** @type {Array<[RegExp, string]>} */
  const rules = [
    [new RegExp(`@app/${PLACEHOLDER.libSlug}`, 'g'), `@app/${LIB}`],
    [new RegExp(`(?<![\\w-])${PLACEHOLDER.next}(?![\\w-])`, 'g'), NEXT],
    [new RegExp(`(?<![\\w-])${PLACEHOLDER.expo}(?![\\w-])`, 'g'), EXPO],
    [new RegExp(`(?<![\\w-])${PLACEHOLDER.gas}(?![\\w-])`, 'g'), GAS],
  ];
  let changed = 0;
  walk(dest, (p) => {
    const base = p.slice(dest.length + 1);
    if (SKIP_FILES.has(base.split('/').pop() ?? '')) return;
    if (BINARY_EXT.has(extname(p).toLowerCase())) return;
    if (replaceInFile(p, rules)) changed++;
  });

  // 3) app.json 标识（name/slug）显式设定 + 断言。
  const appJsonPath = join(dest, 'app', EXPO, 'app.json');
  if (existsSync(appJsonPath)) {
    const cfg = JSON.parse(readFileSync(appJsonPath, 'utf8'));
    cfg.expo = cfg.expo ?? {};
    cfg.expo.name = EXPO;
    cfg.expo.slug = EXPO;
    const output = cfg.expo.web?.output;
    if (output && !['single', 'static'].includes(output)) fail(`app.json web.output 非法: ${output}`);
    if (cfg.expo.experiments?.typedRoutes === true) fail('app.json experiments.typedRoutes 必须为 false');
    writeFileSync(appJsonPath, JSON.stringify(cfg, null, 2) + '\n');
  }

  // 4) 删除模板元文件（不应进入用户项目；其中含 create-next-app 等字样，也非用户项目所需）。
  for (const meta of ['README.md', 'LICENSE']) {
    const mp = join(dest, meta);
    if (existsSync(mp)) unlinkSync(mp);
  }

  // 5) 残留校验：用与替换一致的整词边界（避免 create-next-app 之类子串误报）。
  const residual = [];
  const wholeNext = new RegExp(`(?<![\\w-])${PLACEHOLDER.next}(?![\\w-])`);
  const wholeExpo = new RegExp(`(?<![\\w-])${PLACEHOLDER.expo}(?![\\w-])`);
  const wholeGas = new RegExp(`(?<![\\w-])${PLACEHOLDER.gas}(?![\\w-])`);
  walk(dest, (p) => {
    const base = p.slice(dest.length + 1);
    if (SKIP_FILES.has(base.split('/').pop() ?? '')) return;
    if (BINARY_EXT.has(extname(p).toLowerCase())) return;
    const text = readFileSync(p, 'utf8');
    if (wholeNext.test(text)) residual.push(`${base}: ${PLACEHOLDER.next}`);
    if (wholeExpo.test(text)) residual.push(`${base}: ${PLACEHOLDER.expo}`);
    if (wholeGas.test(text)) residual.push(`${base}: ${PLACEHOLDER.gas}`);
    if (text.includes(PLACEHOLDER.libName)) residual.push(`${base}: ${PLACEHOLDER.libName}`);
  });
  if (residual.length) {
    console.error('rename-starter: 仍有残留占位 token：\n' + residual.join('\n'));
    process.exit(2);
  }

  console.log(
    `rename-starter: 完成。app/${PLACEHOLDER.next}→app/${NEXT}, app/${PLACEHOLDER.expo}→app/${EXPO}, ` +
    `app/${PLACEHOLDER.gas}→app/${GAS}, package/${PLACEHOLDER.libSlug}→package/${LIB}（@app/${LIB}）。改动文件 ${changed} 个。` +
    `\n下一步：在 ${dest} 执行 npm install，然后 npm run check。`,
  );
}

main();
