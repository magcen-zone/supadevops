#!/usr/bin/env bash
# supadevops Stop フック — 回帰確認(高速)。
#
# 仕様(README §2.2 / §3.7 / §6):完了前に `turbo run typecheck test`
# (全ワークスペースの tsc --noEmit + jest〔jest-expo 含む〕)を緑にする。
# endpoint / end2end(Playwright / Maestro)は重く非対話のため Stop には含めない
# (フェーズ4 受入 + 任意で CI で実行する)。
#
# 終了コード: 0=合格(または対象外で no-op) / 2=ブロック(回帰あり。stderr を Claude に渡す)。

set -uo pipefail

input="$(cat 2>/dev/null || true)"

# 無限ループ防止: 直前の停止が Stop フック起因なら再検証しない。
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

# 検証をスキップしたい場合の脱出弁。
if [ "${SUPADEVOPS_SKIP_VALIDATE:-}" = "1" ]; then
  exit 0
fi

proj="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$proj" 2>/dev/null || exit 0

# supadevops モノレポ(turborepo)でなければ何もしない。
[ -f turbo.json ] || exit 0
command -v npx >/dev/null 2>&1 || exit 0

log="$(mktemp -t supadevops-validate.XXXXXX)"
trap 'rm -f "$log"' EXIT

if npx --no-install turbo run typecheck test >"$log" 2>&1; then
  exit 0
fi

{
  echo "supadevops: 回帰確認に失敗しました(turbo run typecheck test)。"
  echo "型(tsc)または単体(jest)が赤です。緑に戻してから完了してください。"
  echo "----- 末尾ログ -----"
  tail -n 40 "$log" 2>/dev/null || true
} >&2
exit 2
