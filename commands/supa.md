---
description: supadevops の契約優先 TDD 開発フロー(5フェーズ・ヒューマンゲート)を起動する。supa-tdd スキルを適用して機能追加/バグ修正を進める
argument-hint: [機能やバグの簡単な説明（任意）]
---

supadevops の開発フローを開始する。**`supa-tdd` スキルを読み込み、その規律に厳密に従うこと**(契約優先・JSDoc・`tsc`/`jest`・配置規約)。

対象タスク: $ARGUMENTS

進め方:

1. **`supa-tdd` スキルを適用**し、5フェーズ(Plan → Test → Implement → 受入 → Finish)とヒューマンゲートを守る。
2. **フェーズ1(契約)**:対象 `.js / .jsx` に多層 JSDoc 契約 + `throw` スタブを直接記し、`tsc -p jsconfig.json --noEmit` が緑であることを確認 → **🚧 ユーザー承認を待つ**。
3. **フェーズ2(red)**:`it.todo` で検証項目を列挙 → **🚧 ユーザー承認を待つ** → 断言を埋めて red にする。
4. **フェーズ3(green)**:スタブをモジュール単位で実装し `jest` + `tsc` を緑にする。
5. **フェーズ4(受入)**:Route Handler に endpoint、全ルート/画面に end2end(web=Playwright / Expo native=Maestro)を実装後に追加。
6. **フェーズ5(Finish)**:レビューし、未実装スタブ(`throw new Error('not implemented')`)が残っていないことを確認。

実装フェーズ(3 実装 / 4 受入 / 5 レビュー)で独立モジュールが3つ以上あり、ユーザーが望む場合は、並列加速のため `supa-implement` / `supa-acceptance` / `supa-review` スキルの利用を提案する(オプトイン。1 Workflow = 1フェーズ。会話側がヒューマンゲートを維持)。

まだ npm workspaces + turborepo のモノレポが無い新規プロジェクトであれば、先に **`/supa-init`** を案内する。規約は `supa-tdd` スキルに従う(本コマンドはその起動口)。
