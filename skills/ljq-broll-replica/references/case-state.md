# 共同案例状态

案例目录是跨 Skill、上下文压缩和重新打开任务后的工作记忆。恢复时读取合同和证据，不依赖聊天中的“右边那张”。

## 目录

```text
workspace/cases/<case-id>/
├── case.json
├── evidence/
│   ├── source.json
│   ├── contact-sheet.png
│   ├── keyframe-*.png
│   ├── layout/<scene>-{source,render,comparison}.png
│   └── motion/continuity.json
├── assets/{originals,extracted}/
├── specs/{layout,motion}.json
├── remotion/
│   ├── composition.tsx
│   ├── runtime.tsx
│   └── schema.ts
└── validation/
    ├── gates.json
    ├── report.json
    └── iterations/pass-N/
```

`case.json` schema 1.2 记录：

- `scope`：原始时码、案例时长、纳入/排除项、排除区域显示方式和遮罩；
- `files`：案例内源片、证据、规格、源码、渲染、QA gates 和报告的索引；
- `stages`：五个阶段的可恢复状态；
- `iteration`：修正上限和已使用次数。

## 真源边界

- `evidence/source.json` 和案例内源片是预检真源，下游不得静默修改。
- `specs/` 是 Skill 之间的机器合同；`remotion/` 是可编辑实现。
- `evidence/` 与 `validation/` 只作为取证和判断，不参与最终画面。
- JSON Schema 和校验器是机器真源；仓库 `docs/contracts/broll-case-contract.md` 是人类可读说明。

## 状态更新

1. 阶段开始时写 `in_progress`。
2. 脚本证据和人工检查都完成后才写 `passed`。
3. 证据不足但可继续人工判断时使用 `needs_review`；缺少关键输入时使用 `blocked`。
4. 修正前使用状态脚本归档本轮 QA，不静默覆盖历史。
5. 只有主 Skill 可以把整个案例写为 `passed`。

## 恢复步骤

1. 读取 `case.json`并运行 `validate-case.mjs <case-dir>`。
2. 检查源片哈希和范围合同。
3. 续做全流程时找到第一个非 `passed` 阶段；用户只要求回归、审阅或文档维护时，以本轮请求选分支，未通过阶段仅作为现状记录。
4. 只加载所选分支的 Skill、规格和相关证据。回归探针按[执行手册](execution-playbook.md#静态基准与动态实现交接)保护批准基准，查询现状保持只读。

源视频变化或范围被用户纠正时，重新预检或建立新案例；不将旧测量静默套到新来源。
