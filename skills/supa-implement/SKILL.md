---
name: supa-implement
description: supadevops フェーズ3(実装)の並列加速。red 済みの独立モジュールが3つ以上ありユーザーがオプトインしたとき、supa-implement-workflow.js を生成して Workflow で並列実装(各モジュール: 実装→turbo typecheck test)する authoring プロンプト。
---

# supa-implement — 実装フェーズの並列 Workflow(authoring)

`supa-tdd` のフェーズ3を **Workflow で並列化**する。**雛形は同梱しない**。本スキルの指示で `.claude/workflows/supa-implement-workflow.js` を生成し `Workflow({ name: 'supa-implement-workflow' })` で起動する。

## 使う条件(すべて満たすとき)
- フェーズ2まで完了(契約 + red テストが揃っている)。
- **互いに import 依存が無く並列実装で衝突しない独立モジュールが3つ以上**。
- **ユーザーがオプトイン**(会話側がヒューマンゲートを維持。Workflow 走行中は人間入力不可)。
- 会話内 subagent-driven と **同時併用しない**(駆動役は択一。§4.1)。

満たさなければ Workflow 化せず、会話内で逐次実装する。

## 生成手順
1. 未実装スタブを含む `.js/.jsx` から `args` を導く:`[{ file, testFile }, ...]`(独立モジュールのみ)。
2. 配置スコープ(§7):install が `--scope project` なら `repo/.claude/workflows/`、既定 user なら `~/.claude/workflows/`。
3. 下記スクリプトを `supa-implement-workflow.js` として書き、`Workflow({ name: 'supa-implement-workflow' })` で起動。`args` は実 JSON で渡る。
4. 集約結果を会話へ返し、**フェーズ4(ゲート)** へ。

## スクリプト雛形
```js
export const meta = {
  name: 'supa-implement-workflow',
  description: 'red 済みモジュールを並列実装し turbo typecheck test が緑になるまで検証',
  phases: [{ title: 'Implement' }, { title: 'Verify' }],
}
const VERDICT = { type: 'object', properties: { green: { type: 'boolean' }, note: { type: 'string' } }, required: ['green'] }
const out = await pipeline(args,
  m => agent(`${m.file} のスタブ本体を実装し ${m.testFile} を green に。JS+JSDoc・ESM。契約(JSDoc)は変えない。throw を残さない。`,
             { agentType: 'supa-implementer', label: `impl:${m.file}`, phase: 'Implement' }),
  (_, m) => agent(`${m.file} を検証: 当該 workspace で turbo run typecheck test(無ければ tsc -p jsconfig.json --noEmit と jest)。失敗なら原因を返す。`,
             { agentType: 'supa-implementer', label: `verify:${m.file}`, phase: 'Verify', schema: VERDICT }))
return { results: out.filter(Boolean) }
```

subagent は `agentType: 'supa-implementer'`(内部でも JSDoc / tsc / jest の規律を適用)。
