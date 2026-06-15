---
name: supa-acceptance
description: supadevops フェーズ4(受入)の並列加速。実装済みで対象(Route Handler / next ルート / Expo 画面)が3つ以上ありユーザーがオプトインしたとき、supa-acceptance-workflow.js を生成して endpoint・end2end を並列に生成・実行する authoring プロンプト。
---

# supa-acceptance — 受入フェーズの並列 Workflow(authoring)

`supa-tdd` のフェーズ4(endpoint・end2end の**実装後の受入テスト**)を Workflow で並列化する。**雛形は同梱しない**。`.claude/workflows/supa-acceptance-workflow.js` を生成し `Workflow({ name: 'supa-acceptance-workflow' })` で起動する。

## 使う条件
- フェーズ3まで完了(実装が green)。
- 受入対象が3つ以上:**Route Handler ごとに endpoint**、**next ルート / Expo web ごとに Playwright end2end**、**Expo 画面ごとに Maestro**。
- **ユーザーがオプトイン**。会話側がゲートを維持。駆動役は択一。

## 生成手順
1. `args` を導く:`[{ kind, target, spec }, ...]`。`kind` は `endpoint` / `e2e-web` / `e2e-native`。`spec` は生成先(`src/endpoint/*.spec.js` / `src/end2end/[web/]*.spec.js` / `src/end2end/native/*.yaml`)。
2. 配置スコープは §7(project=repo / user=HOME)。
3. 下記を `supa-acceptance-workflow.js` として書き起動。`args` は実 JSON。
4. 集約結果を会話へ返し **フェーズ5** へ。

## スクリプト雛形
```js
export const meta = {
  name: 'supa-acceptance-workflow',
  description: 'Route Handler に endpoint、ルート/画面に end2end を並列生成・実行',
  phases: [{ title: 'Author' }, { title: 'Run' }],
}
const VERDICT = { type: 'object', properties: { pass: { type: 'boolean' }, note: { type: 'string' } }, required: ['pass'] }
const out = await pipeline(args,
  t => agent(`${t.target} の受入テストを ${t.spec} に生成。kind=${t.kind}。` +
             `endpoint=Playwright request(共通・外部サービスは env で stub した dev サーバ・ブラウザ無し)、` +
             `e2e-web=Playwright(ブラウザ)、e2e-native=Maestro フロー(*.yaml)。配置・規約は README §3.4/§3.6。`,
             { agentType: 'supa-implementer', label: `author:${t.target}`, phase: 'Author' }),
  (_, t) => agent(`${t.spec} を実行し結果を返す(endpoint/e2e-web=Playwright、e2e-native=prebuild+expo run 後に maestro test)。`,
             { label: `run:${t.target}`, phase: 'Run', schema: VERDICT }))
return { results: out.filter(Boolean) }
```

endpoint/end2end は重く非対話のため Stop フックには含めない(本 Workflow か CI で実行)。
