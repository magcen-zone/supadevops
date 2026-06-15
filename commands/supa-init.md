---
description: npm workspaces + turborepo の中立なモノレポ(Next.js / Expo + 共有ライブラリ)を公式 CLI と npm 命令で初期化する
argument-hint: [next-<名> 例: next-shop] [expo-<名> 例: expo-shop] [package/<lib> 例: order api-client]
allowed-tools: Bash, Read, Write, Edit, Glob
---

supadevops の中立なモノレポ足場を作る。**雛形は同梱せず、生成物は公式 CLI と npm 命令に委譲する**(`package.json` / `package-lock.json` / `node_modules` は npm が生成し手書きしない)。**プラグインはデプロイに中立**で、デプロイ設定(apphosting.yaml / firebase.json 等)は作らない(開発者裁量)。

入力(無ければユーザーに確認): $ARGUMENTS

---

### 0. 前提確認
- 対象ディレクトリ(既定はカレント)が空 or 新規であることを確認。既存ファイルを壊さない。大きな破壊的操作の前にユーザーへ確認する。
- `node` / `npm` / `npx` が使えること。Expo native のローカルビルドや Maestro は別途(Xcode / Android SDK / `maestro` CLI)で、init では必須にしない。

### 1. root(npm workspaces + turborepo)
```bash
npm init -y
npm pkg set type=module private=true
npm pkg set workspaces[]='app/*' workspaces[]='package/*'
npm install -D -w . turbo typescript @types/node
```
`turbo.json` を作成(タスクパイプライン。§3.7):
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck": { "cache": true },
    "test": { "cache": true, "dependsOn": ["^build"] },
    "lint": { "cache": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```
回帰確認は `turbo run typecheck test`(Stop フックが実行)。

### 2. Next.js アプリ `app/next-<名>`(JS + src/app)
非対話で JavaScript 生成(`--yes` は既定 TS のため使わない):
```bash
npx create-next-app@latest app/next-<名> --js --app --src-dir --no-eslint --no-tailwind --no-import-alias --use-npm
```
その後 supadevops 規約へ整える:
- ディレクトリ: `src/{helper,action,component,type,endpoint,end2end}` を作る(`src/app` は create-next-app 済み)。
- `jsconfig.json` に `allowJs` + `checkJs` + `noEmit` + `jsx` + `types: ["node"]`。各 `.js/.jsx` 先頭に `// @ts-check`。
- `next.config.js` に `transpilePackages: ['@app/<lib>', ...]`(共有ライブラリ取り込みに必須)。
- 開発依存: `npm install -D -w app/next-<名> @playwright/test msw @types/react jest @jest/globals`。
- `package.json` scripts に `"typecheck": "tsc -p jsconfig.json --noEmit"`、`"test": "NODE_OPTIONS=--experimental-vm-modules jest"`。

### 3. Expo アプリ `app/expo-<名>`(JS+JSDoc・Expo Router・⚠ 最高リスク工程)
既定(TS + Expo Router)で生成 → **JS+JSDoc へ変換**する:
```bash
npx create-expo-app@latest app/expo-<名>
```
変換(慎重に・差分を確認しながら):
- `.ts/.tsx` を `.js/.jsx` にリネームし、**型注釈を除去して JSDoc に移す**。
- `tsconfig.json` を削除し `jsconfig.json`(`allowJs`/`checkJs`/`noEmit`/`jsx`/`types`)を置く。各ファイル先頭に `// @ts-check`。
- `metro.config.js` / `babel.config.js` を **`.cjs` にリネーム**(root が `type:module` のため `.js` は ESM 扱いで壊れる)。
- Expo Router は `src/app/` を採用(`app/` を `src/app/` へ)。**typed routes は無効化**。
- `app.json` の `expo.web.output` を `single`(SPA)または `static`(SSG)に設定。
- ディレクトリ: `src/{helper,action,component,type,endpoint,end2end/{web,native}}`(`action/`・`endpoint/` は将来 SSR 用の予約枠で現状は空でよい)。
- 開発依存: `npm install -D -w app/expo-<名> jest-expo @playwright/test`(Maestro は npm 依存でなく別途)。
- `package.json` scripts に `typecheck` と `test`(jest-expo)。

### 4. 共有ライブラリ `package/<lib>`(プラットフォーム非依存のみ)
各 lib ごとに:
- `package/<lib>/package.json`:`"name": "@app/<lib>"`, `"type": "module"`, `"main": "src/index.js"`(or exports)。**React DOM 専用 `.jsx` は置かない**(helper / type / hooks / API クライアントのみ)。
- `src/{helper,type}` + `jsconfig.json` + `// @ts-check`。
- scripts に `typecheck` / `test`。

### 5. 配線と確認
- 各アプリの `package.json` に共有ライブラリ依存 `"@app/<lib>": "*"` を宣言(workspaces が解決)。
- root で `npm install`(lockfile / node_modules を hoist 生成)。
- `npx turbo run typecheck test` を実行し、足場が緑(または既知の空状態)であることを確認。

### 6. 完了報告
- 生成物のツリーと、次の一歩(`/supa` で最初の機能の契約→テスト→実装)を案内。
- **デプロイは開発者裁量**(App Hosting / Cloud Run / Firebase Hosting / ローカル等)。init では設定しない旨を明記(参考は README §1.4 末尾)。
