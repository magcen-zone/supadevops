---
description: 从 supa-starter 冻结模板取得并确定性重命名，初始化一个对部署保持中立的 npm workspaces + turborepo monorepo（Next.js / Expo + 共享库）
argument-hint: [next-<名> 例: next-shop] [expo-<名> 例: expo-shop] [lib-<名> 例: order]
allowed-tools: Bash, Read
---

以 supadevops 的**冻结起步模板** `magcen-zone/supa-starter`（已确认 `turbo run typecheck test` 为绿）初始化 monorepo。**不再每次用 `create-next-app` / `create-expo-app` 重新生成**（那是非确定性的，尤其 Expo 的 TS→JS+JSDoc 转换）——改为**以固定 tag 取得模板（degit）+ 确定性重命名**。`create-*` 与转换只在模板的维护侧执行一次。

输入（若无则向用户确认）: $ARGUMENTS
- 解析为三个名字：**next 应用名 / expo 应用名 / 共享库名**（均须匹配 `^[a-z0-9][a-z0-9-]*$`，例 `next-shop` / `expo-shop` / `order`）。

固定引用（模板版本，随 supadevops 发布同步更新）:

```
SUPA_STARTER_REF = magcen-zone/supa-starter#v0.1.0
```

**必须以 tag 固定**（不用 `dev` / `main`，避免取到未审查的模板，保证可重复）。

---

## 0. 前提
- 可用 `node` / `npm` / `npx`。Expo native 的本地构建与 Maestro 另行处理（Xcode / Android SDK / `maestro` CLI），不在 init 中设为必需。
- **目标目录为当前目录，且为空**（degit 不覆盖非空目录）。若非空，先与用户确认或改用新建子目录。
- 确认三个名字（next / expo / lib）。

## 1. 取得模板（degit，固定 tag）

```bash
npx --yes degit "magcen-zone/supa-starter#v0.1.0" .
```

degit 取得该 tag 的快照（**无 `.git` / 无 `node_modules`**）。失败时回退到浅克隆：

```bash
git clone --depth 1 --branch v0.1.0 git@github.com:magcen-zone/supa-starter.git .supa-tmp \
  && rm -rf .supa-tmp/.git && cp -R .supa-tmp/. . && rm -rf .supa-tmp
```

## 2. 确定性重命名

用插件内置脚本把占位名 `next-app` / `expo-app` / `core`（npm 名 `@app/core`）替换为项目名 —— 目录名 + 文件内 token + `app.json` 标识 + **锁文件中的 workspace 项**，并删除模板的 `README.md` / `LICENSE`：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rename-starter.mjs" . --next <next-名> --expo <expo-名> --lib <lib-名>
```

脚本是**确定性的、零依赖、可重复**（同参数 → 字节级同结果），并在最后校验无残留占位 token。退出非 0 时**停止并报告**。

## 3. 安装与回归确认

```bash
npm install
npx turbo run typecheck test
```

- 用 **`npm install`（不是 `npm ci`）**：重命名改写了锁文件的 workspace 名，`npm install` 在**保留外部依赖精确锁定**的同时重建 `node_modules`。
- `turbo run typecheck test` 须为绿（全 workspace 的 `tsc -p jsconfig.json --noEmit` + `jest`〔含 jest-expo〕）。**为红则停止、提示末尾日志**（与 Stop 钩子契约一致）。

## 4. 完成报告
- 展示生成的目录树（`app/<next>` / `app/<expo>` / `package/<lib>`）与下一步：用 **`/supa`** 进行首个功能的契约→测试→实现。
- 模板已是**实现就绪的雏形**（无 `throw new Error('not implemented')` 桩；`package/<lib>` 含示例 helper + 通过的单测，可替换/删除）。
- **部署由开发者裁量**（App Hosting / Cloud Run / Firebase Hosting / 本地等）。init 不做任何部署配置。

## 5. 超出模板形状（多 app / 多 lib）

模板为正准 **1×next + 1×expo + 1×lib**。如需更多，**取得后手动调整**（仍是确定性的复制 + 改名，不重新跑 `create-*`）：
- **追加共享库**：复制 `package/<lib>` 为新目录，改其 `package.json` 的 `name`（`@app/<新>`），并在用到的 app 的 `dependencies` 与 `next.config.mjs` 的 `transpilePackages` 中登记。
- **追加 next / expo 应用**：复制对应 `app/<名>` 目录并改名（`package.json` 的 `name`、Expo 的 `app.json` slug/name 等）。
- 或在 `magcen-zone/supa-starter` 用其再生成步骤生成不同形状（维护者侧）。`create-next-app` / `create-expo-app` + TS→JS+JSDoc 转换现**仅存在于该模板的生成侧**，不在本命令的用户运行时。
