---
description: 启动 supadevops 的契约优先 TDD 开发流程(5 阶段、人工门控)。应用 supa-tdd 技能推进新增功能/缺陷修复
argument-hint: [功能或缺陷的简要说明（可选）]
---

启动 supadevops 的开发流程。**加载 `supa-tdd` 技能，并严格遵循其纪律**(契约优先、JSDoc、`tsc`/`jest`、放置位置规约)。

目标任务: $ARGUMENTS

推进方式:

1. **应用 `supa-tdd` 技能**,遵守 5 阶段(Plan → Test → Implement → 受入 → Finish)与人工门控。
2. **阶段1(契约)**:在目标 `.js / .jsx` 中直接写入多层 JSDoc 契约 + `throw` 桩,并确认 `tsc -p jsconfig.json --noEmit` 为绿 → **🚧 等待用户批准**。
3. **阶段2(red)**:用 `it.todo` 列举验证项 → **🚧 等待用户批准** → 填入断言使其变红。
4. **阶段3(green)**:按模块逐一实现桩,使 `jest` + `tsc` 变绿。
5. **阶段4(受入)**:为 Route Handler 添加 endpoint,在所有路由/画面实现 end2end(web=Playwright / Expo native=Maestro)后追加。
6. **阶段5(Finish)**:进行评审,确认没有残留未实现的桩(`throw new Error('not implemented')`)。

在实现阶段(3 实现 / 4 受入 / 5 评审)中,若独立模块达到 3 个以上且用户希望,则为并行加速建议使用 `supa-implement` / `supa-acceptance` / `supa-review` 技能(选择启用(opt-in)。1 Workflow = 1 阶段。由会话侧维持人工门控)。

若是尚无 npm workspaces + turborepo monorepo 的新建项目,先引导至 **`/supa-init`**。规约遵循 `supa-tdd` 技能(本命令是其入口)。
