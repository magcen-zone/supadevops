#!/usr/bin/env bash
# supadevops Stop 钩子 —— 回归确认(高速)。
#
# 规格: 在完成前让 `turbo run typecheck test`
# (所有 workspace 的 tsc --noEmit + jest〔含 jest-expo〕)变绿。
# endpoint / end2end(Playwright / Maestro)重且非交互，因此不纳入 Stop
# (在阶段4 受入 + 可选地在 CI 中执行)。
#
# 退出码: 0=通过(或不适用时为 no-op) / 2=阻断(存在回归。将 stderr 传给 Claude)。

set -uo pipefail

input="$(cat 2>/dev/null || true)"

# 防止无限循环: 若上一次停止由 Stop 钩子引起，则不重新校验。
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

# 想要跳过校验时的逃生阀。
if [ "${SUPADEVOPS_SKIP_VALIDATE:-}" = "1" ]; then
  exit 0
fi

proj="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$proj" 2>/dev/null || exit 0

# 若不是 supadevops monorepo(turborepo)则什么都不做。
[ -f turbo.json ] || exit 0
command -v npx >/dev/null 2>&1 || exit 0

log="$(mktemp -t supadevops-validate.XXXXXX)"
trap 'rm -f "$log"' EXIT

if npx --no-install turbo run typecheck test >"$log" 2>&1; then
  exit 0
fi

{
  echo "supadevops: 回归确认失败(turbo run typecheck test)。"
  echo "类型(tsc)或单元(jest)为红。请先恢复为绿再完成。"
  echo "----- 末尾日志 -----"
  tail -n 40 "$log" 2>/dev/null || true
} >&2
exit 2
