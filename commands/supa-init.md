---
description: 按照具体目录树和配置全文，初始化一个对部署保持中立的 npm workspaces + turborepo monorepo（Next.js / Expo + 共享库）
argument-hint: [next-<名> 例: next-shop] [expo-<名> 例: expo-shop] [package/<lib> 例: order api-client]
allowed-tools: Bash, Read, Write, Edit, Glob
---

创建 supadevops 的**对部署保持中立的 monorepo 脚手架**。应用本体委托给官方 CLI（`create-next-app` / `create-expo-app`），`package.json` / `package-lock.json` / `node_modules` 由 npm 生成（不手写）。**除此之外的固有配置一律按本命令的全文写出**。**不创建部署配置**（由开发者裁量）。

输入（若无则向用户确认）: $ARGUMENTS

---

## 0. 前提检查
- 目标目录（默认是当前目录）为空或新建。不破坏既有文件。在大型破坏性操作之前进行确认。
- 可用 `node` / `npm` / `npx`。Expo native 的本地构建和 Maestro 另行处理（Xcode / Android SDK / `maestro` CLI），在 init 中不设为必需。
- 确定要创建的应用名（`next-<名>` / `expo-<名>`）和共享库名（`package/<lib>`）。

## 1. 目标构成（这就是要创建的）

```
<repo>/
├─ package.json                     # type:module, workspaces:["app/*","package/*"]
├─ package-lock.json                # npm 生成
├─ node_modules/                    # hoisted
├─ turbo.json
├─ app/
│  ├─ next-<名>/                    # create-next-app（JS、src/app）
│  │  ├─ package.json               # app 根目录直下
│  │  ├─ next.config.mjs            # app 根目录直下（transpilePackages）
│  │  ├─ jsconfig.json              # app 根目录直下（checkJs）
│  │  ├─ jest.config.js             # app 根目录直下（ESM）
│  │  └─ src/                       # ↓ 从这里开始全部位于 src/ 直下
│  │     ├─ helper/
│  │     ├─ action/
│  │     ├─ component/
│  │     ├─ type/
│  │     ├─ app/                    # = src/app（create-next-app 生成。page、layout、api/**/route.js）
│  │     ├─ endpoint/
│  │     └─ end2end/
│  └─ expo-<名>/                    # create-expo-app（默认 TS→JS+JSDoc 化）
│     ├─ package.json               # app 根目录直下
│     ├─ app.json                   # app 根目录直下（web.output, typedRoutes:false）
│     ├─ metro.config.cjs           # app 根目录直下（CJS）
│     ├─ babel.config.cjs           # app 根目录直下（CJS）
│     ├─ jest.config.cjs            # app 根目录直下（jest-expo）
│     ├─ jsconfig.json              # app 根目录直下
│     └─ src/                       # ↓ 从这里开始全部位于 src/ 直下
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
   └─ <lib>/                        # 共享库（可多个）
      ├─ package.json               # lib 根目录直下（@app/<lib>, type:module, exports）
      ├─ jsconfig.json              # lib 根目录直下
      ├─ jest.config.js             # lib 根目录直下（ESM）
      └─ src/                       # ↓ 从这里开始全部位于 src/ 直下
         ├─ index.js                # = src/index.js（re-export 公开 API）
         ├─ helper/
         └─ type/
```

## 2. root（npm workspaces + turborepo）
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
回归确认用 `turbo run typecheck test`（由 Stop 钩子执行）。

## 3. Next.js 应用 `app/next-<名>`（JS + src/app）
```bash
npx create-next-app@latest app/next-<名> --js --app --src-dir --no-eslint --no-tailwind --no-import-alias --use-npm
cd app/next-<名> && npm pkg set type=module \
  && npm pkg set scripts.typecheck='tsc -p jsconfig.json --noEmit' \
  && npm pkg set scripts.test='NODE_OPTIONS=--experimental-vm-modules jest' \
  && npm install -D @playwright/test msw @types/react jest @jest/globals \
  && mkdir -p src/helper src/action src/component src/type src/endpoint src/end2end && cd -
```
`app/next-<名>/next.config.mjs`（引入共享库）:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@app/<lib>'],
};
export default nextConfig;
```
`app/next-<名>/jsconfig.json`（在 create-next-app 生成物上加入 checkJs / types）:
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
`app/next-<名>/jest.config.js`（ESM、native。不使用 babel）:
```js
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/?(*.)+(test).js'],
};
```
每个 `.js/.jsx` 开头加 `// @ts-check`。

## 4. Expo 应用 `app/expo-<名>`（JS+JSDoc、Expo Router、⚠ 最高风险步骤）
```bash
npx create-expo-app@latest app/expo-<名>
cd app/expo-<名> && npm pkg set type=module \
  && npm pkg set scripts.typecheck='tsc -p jsconfig.json --noEmit' \
  && npm pkg set scripts.test='jest' \
  && npm install -D jest-expo @playwright/test && cd -
```
**TS→JS+JSDoc 转换检查清单（按顺序、每个步骤检查差异）**:
1. 把 `app/` 移到 `src/app/`（采用 Expo Router 的 `src/app`）。
2. 把 `.ts/.tsx` 重命名为 `.js/.jsx`。
3. **移除类型注释、`interface`、generics、`import type`**，必要的类型移到 **JSDoc**。每个文件开头加 `// @ts-check`。
4. 删除 `tsconfig.json` 并放置 `jsconfig.json`（见下）。
5. 把 `metro.config.js` / `babel.config.js` 重命名为 **`.cjs`**（按下述内容确认）。
6. 在 `app.json` 中设置 `expo.web.output`（`single`=SPA / `static`=SSG），并把 `expo.experiments.typedRoutes` 设为 **false**（或删除该键）。
7. 全部在 src/ 直下创建:`mkdir -p src/helper src/action src/component src/type src/endpoint src/end2end/web src/end2end/native`（步骤1已完成 `app/` → `src/app/`。`action/`、`endpoint/` 是将来 SSR 用的预留位，当前为空即可）。
8. 动作确认:`npx expo start --web` 启动 / `npm run typecheck` / `npm test`（jest-expo）通过。

`app/expo-<名>/metro.config.cjs`（Expo 的 metro-config 会自动检测 npm monorepo）:
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
`app/expo-<名>/jest.config.cjs`（jest-expo 用 babel 转换。CJS）:
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

## 5. 共享库 `package/<lib>`（仅限平台无关）
为每个 lib 创建（**不放置 React DOM 专用的 `.jsx`**。限于 helper / type / hooks / API 客户端）:
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
`package/<lib>/jest.config.js`（ESM）:
```js
export default { testEnvironment: 'node', transform: {}, testMatch: ['**/?(*.)+(test).js'] };
```
在 `package/<lib>/src/index.js` 中 re-export 公开 API。每个 `.js` 开头加 `// @ts-check`。

## 6. 接线与确认
- 在各应用的 `package.json` 中声明依赖:`npm pkg set dependencies.@app/<lib>='*' -w app/next-<名>`（在所有需要的 app 上）。同时也加入 `next.config.mjs` 的 `transpilePackages`。
- 在 root 执行 `npm install`（hoist 生成 lockfile / node_modules）。
- 执行 `npx turbo run typecheck test`，确认脚手架为绿。

## 7. 完成报告
- 引导生成的目录树，以及下一步（用 `/supa` 进行首个功能的契约→测试→实现）。
- **部署由开发者裁量**（App Hosting / Cloud Run / Firebase Hosting / 本地等）。init 中不进行配置。
