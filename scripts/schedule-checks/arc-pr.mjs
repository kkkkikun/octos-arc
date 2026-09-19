// ARC「交 PR / 合并」的前置检查。
// exit 0 = 有事可做；exit 2 = 无事，跳过（零 token）；其它 = 意外，fail-closed。
//
// **必须保持快**（实测教训）：第一版把 `run_lite.py --check` 放进来，
// 而它要翻十页运行列表再拉每个在跑运行的日志，自测 **30s 超时 → block**。
// 那会把每一轮都 fail-closed 掉，比不装钩子还糟。
// lite 由专职任务 47134b1b（每 30 分钟）负责，这里**不重复查**，
// 顺便也避开了两个任务同时 `--go` 双重起运行的竞争。
//
// 有事可做（任一成立）：未提交改动 / 领先 origin/main / 有开着的 PR / web 监督者死了
import { execSync } from 'node:child_process';

const REPO = '/Users/mac/Desktop/code/octos-org/octos-arc-0917';
const reasons = [];

function probe(cmd, timeout) {
  try {
    const out = execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout });
    return { code: 0, out: String(out).trim() };
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : -1, out: String(e.stdout || '').trim() };
  }
}

function must(cmd, timeout) {
  return String(execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout })).trim();
}

try {
  // 本地、毫秒级。查不了就抩住本轮（不该静默跳过）。
  const dirty = must('git status --porcelain', 15000);
  if (dirty) reasons.push(`未提交改动 ${dirty.split('\n').length} 处`);

  // fetch 允许失败（离线）；失败就拿本地已知的 origin/main 比
  probe('git fetch origin --quiet', 12000);
  const ahead = must('git log --oneline origin/main..HEAD', 15000);
  if (ahead) reasons.push(`领先 main ${ahead.split('\n').length} 个提交`);

  // gh 未登录/限流是「查不到」而不是「没有」，所以只在它确实说有时才算
  const pr = probe('gh pr list --state open --json number --jq length', 12000);
  if (pr.code === 0 && pr.out && pr.out !== '0') reasons.push(`${pr.out} 个 PR 开着`);

  // 监督者死了要报警（pgrep 无命中时退 1，那就是「死了」）
  const sup = probe('pgrep -f run_web.py', 8000);
  if (sup.code !== 0 || !sup.out) reasons.push('web 监督者不在了');

  if (reasons.length) {
    console.log('放行：' + reasons.join('；'));
    process.exit(0);
  }
  console.log('无事可做：工作树干净、无领先提交、无开着的 PR、监督者在跑');
  process.exit(2);
} catch (err) {
  console.error('前置检查本身出错，fail-closed 阻止本轮：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
