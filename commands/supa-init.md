---
description: npm workspaces + turborepo の中立なモノレポ(Next.js / Expo + 共有ライブラリ)を、具体ツリーと設定の全文に沿って初期化する
argument-hint: [next-<名> 例: next-shop] [expo-<名> 例: expo-shop] [package/<lib> 例: order api-client]
allowed-tools: Bash, Read, Write, Edit, Glob
---

supadevops の**中立なモノレポ足場**を作る。アプリ本体は公式 CLI(`create-next-app` / `create-expo-app`)に委譲し、`package.json` / `package-lock.json` / `node_modules` は npm が生成する(手書きしない)。**それ以外の固有設定は本コマンドの全文どおりに書き出す**。**デプロイ設定は作らない**(開発者裁量)。

入力(無ければユーザーに確認): $ARGUMENTS

---

## 0. 前提確認
- 対象ディレクトリ(既定はカレント)が空 or 新規であること。既存ファイルを壊さない。大きな破壊的操作の前に確認する。
- `node` / `npm` / `npx` が使えること。Expo native のローカルビルドや Maestro は別途(Xcode / Android SDK / `maestro` CLI)で、init では必須にしない。
- 作るアプリ名(`next-<名>` / `expo-<名>`)と共有ライブラリ名(`package/<lib>`)を確定する。

## 1. ターゲット構成(これを作る)

```
<repo>/
├─ package.json                     # type:module, workspaces:["app/*","package/*"]
├─ package-lock.json                # npm 生成
├─ node_modules/                    # hoisted
├─ turbo.json
├─ app/
│  ├─ next-<名>/                    # create-next-app（JS・src/app）
│  │  ├─ package.json               # app ルート直下
│  │  ├─ next.config.mjs            # app ルート直下（transpilePackages）
│  │  ├─ jsconfig.json              # app ルート直下（checkJs）
│  │  ├─ jest.config.js             # app ルート直下（ESM）
│  │  └─ src/                       # ↓ ここから全部 src/ の直下
│  │     ├─ helper/
│  │     ├─ action/
│  │     ├─ component/
│  │     ├─ type/
│  │     ├─ app/                    # = src/app（create-next-app 生成。page・layout・api/**/route.js）
│  │     ├─ endpoint/
│  │     └─ end2end/
│  └─ expo-<名>/                    # create-expo-app（既定 TS→JS+JSDoc 化）
│     ├─ package.json               # app ルート直下
│     ├─ app.json                   # app ルート直下（web.output, typedRoutes:false）
│     ├─ metro.config.cjs           # app ルート直下（CJS）
│     ├─ babel.config.cjs           # app ルート直下（CJS）
│     ├─ jest.config.cjs            # app ルート直下（jest-expo）
│     ├─ jsconfig.json              # app ルート直下
│     └─ src/                       # ↓ ここから全部 src/ の直下
│        ├─ helper/
│        ├─ action/
│        ├─ component/
│        ├─ type/
│        ├─ app/                    # = src/app（Expo Router 画面）
│        ├─ endpoint/
│        └─ end2end/
│           ├─ web/                 # Playwright
│           └─ native/              # Maestro（*.yaml）
└─ package/
   └─ <lib>/                        # 共有ライブラリ（複数可）
      ├─ package.json               # lib ルート直下（@app/<lib>, type:module, exports）
      ├─ jsconfig.json              # lib ルート直下
      ├─ jest.config.js             # lib ルート直下（ESM）
      └─ src/                       # ↓ ここから全部 src/ の直下
         ├─ index.js                # = src/index.js（公開 API を re-export）
         ├─ helper/
         └─ type/
```

## 2. root(npm workspaces + turborepo)
```bash
npm init -y
npm pkg set type=module private=true
npm pkg set workspaces[]='app/*' workspaces[]='package/*'
npm pkg set scripts.typecheck='turbo run typecheck' scripts.test='turbo run test' scripts.lint='turbo run lint' scripts.build='turbo run build' scripts.dev='turbo run dev'
npm install -D turbo typescript @types/node
```
`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck": {},
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```
回帰確認は `turbo run typecheck test`(Stop フックが実行)。

## 3. Next.js アプリ `app/next-<名>`(JS + src/app)
```bash
npx create-next-app@latest app/next-<名> --js --app --src-dir --no-eslint --no-tailwind --no-import-alias --use-npm
cd app/next-<名> && npm pkg set type=module \
  && npm pkg set scripts.typecheck='tsc -p jsconfig.json --noEmit' \
  && npm pkg set scripts.test='NODE_OPTIONS=--experimental-vm-modules jest' \
  && npm install -D @playwright/test msw @types/react jest @jest/globals \
  && mkdir -p src/helper src/action src/component src/type src/endpoint src/end2end && cd -
```
`app/next-<名>/next.config.mjs`(共有ライブラリを取り込む):
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@app/<lib>'],
};
export default nextConfig;
```
`app/next-<名>/jsconfig.json`(create-next-app 生成物に checkJs / types を足す):
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "esnext",
    "types": ["node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```
`app/next-<名>/jest.config.js`(ESM・native。babel 不使用):
```js
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/?(*.)+(test).js'],
};
```
各 `.js/.jsx` 先頭に `// @ts-check`。

## 4. Expo アプリ `app/expo-<名>`(JS+JSDoc・Expo Router・⚠ 最高リスク工程)
```bash
npx create-expo-app@latest app/expo-<名>
cd app/expo-<名> && npm pkg set type=module \
  && npm pkg set scripts.typecheck='tsc -p jsconfig.json --noEmit' \
  && npm pkg set scripts.test='jest' \
  && npm install -D jest-expo @playwright/test && cd -
```
**TS→JS+JSDoc 変換チェックリスト(順序どおり・各手順で差分確認)**:
1. `app/` を `src/app/` に移す(Expo Router の `src/app` を採用)。
2. `.ts/.tsx` を `.js/.jsx` にリネーム。
3. **型注釈・`interface`・generics・`import type` を除去**し、必要な型は **JSDoc** に移す。各ファイル先頭に `// @ts-check`。
4. `tsconfig.json` を削除し `jsconfig.json`(下記)を置く。
5. `metro.config.js` / `babel.config.js` を **`.cjs`** にリネーム(下記内容で確認)。
6. `app.json` に `expo.web.output`(`single`=SPA / `static`=SSG)を設定し、`expo.experiments.typedRoutes` を **false**(または該当キー削除)。
7. すべて src/ の直下に作る:`mkdir -p src/helper src/action src/component src/type src/endpoint src/end2end/web src/end2end/native`(手順1で `app/` → `src/app/` 済み。`action/`・`endpoint/` は将来 SSR 用の予約枠で現状は空でよい)。
8. 動作確認:`npx expo start --web` が起動 / `npm run typecheck` / `npm test`(jest-expo)が通る。

`app/expo-<名>/metro.config.cjs`(Expo の metro-config は npm モノレポを自動検出):
```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```
`app/expo-<名>/babel.config.cjs`:
```js
module.exports = (api) => {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```
`app/expo-<名>/jest.config.cjs`(jest-expo は babel 変換。CJS):
```js
module.exports = { preset: 'jest-expo' };
```
`app/expo-<名>/jsconfig.json`:
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "esnext",
    "types": ["node"]
  },
  "include": ["src"]
}
```

## 5. 共有ライブラリ `package/<lib>`(プラットフォーム非依存のみ)
各 lib ごとに作る(**React DOM 専用 `.jsx` は置かない**。helper / type / hooks / API クライアントに限る):
```bash
mkdir -p package/<lib>/src/helper package/<lib>/src/type
```
`package/<lib>/package.json`:
```json
{
  "name": "@app/<lib>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "scripts": {
    "typecheck": "tsc -p jsconfig.json --noEmit",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  },
  "devDependencies": { "jest": "^29", "@jest/globals": "^29", "typescript": "^5" }
}
```
`package/<lib>/jsconfig.json`:
```json
{
  "compilerOptions": {
    "allowJs": true, "checkJs": true, "noEmit": true,
    "module": "esnext", "moduleResolution": "bundler", "target": "esnext", "types": ["node"]
  },
  "include": ["src"]
}
```
`package/<lib>/jest.config.js`(ESM):
```js
export default { testEnvironment: 'node', transform: {}, testMatch: ['**/?(*.)+(test).js'] };
```
`package/<lib>/src/index.js` で公開 API を re-export。各 `.js` 先頭に `// @ts-check`。

## 6. 配線と確認
- 各アプリの `package.json` に依存を宣言:`npm pkg set dependencies.@app/<lib>='*' -w app/next-<名>`(必要な app 全てに)。`next.config.mjs` の `transpilePackages` にも追加。
- root で `npm install`(lockfile / node_modules を hoist 生成)。
- `npx turbo run typecheck test` を実行し、足場が緑であることを確認。

## 7. 完了報告
- 生成ツリーと、次の一歩(`/supa` で最初の機能の契約→テスト→実装)を案内する。
- **デプロイは開発者裁量**(App Hosting / Cloud Run / Firebase Hosting / ローカル等)。init では設定しない。
