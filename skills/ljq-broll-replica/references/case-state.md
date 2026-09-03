# 共同案例状态

## 为什么必须持久化

同一个 Codex 任务加载不同 Skill 时仍是同一个模型，但任务中断、上下文压缩、重新打开或换任务后不能依赖对话记忆。案例目录是跨阶段、跨会话的工作记忆。

## 默认目录

```text
workspace/cases/<case-id>/
├── case.json
├── evidence/
│   ├── source.json
│   ├── contact-sheet.png
│   └── keyframe-*.png
├── assets/
│   ├── originals/
│   └── extracted/
├── specs/
│   ├── layout.json
│   └── motion.json
├── remotion/
│   ├── composition.tsx
│   ├── runtime.tsx
│   └── schema.ts
└── validation/
    ├── report.json
    ├── comparison.png
    └── iterations/
```

## 真源边界

- `evidence/` 是不可被下游静默修改的来源证据。
- `case.json` 记录来源摘要、阶段状态、文件索引和修正次数。
- `specs/` 是子 Skill 之间的交接合同。
- `remotion/composition.tsx` 是实际可编辑的视觉实现。
- `remotion/schema.ts` 定义下次能够替换的内容和素材。
- `validation/` 保存 QA 证据，不参与最终画面。

机器可读 Schema、校验器、环境安装和通用 Remotion runtime 都随主 Skill 自包含分发。GitHub 项目中的 `docs/contracts/broll-case-contract.md` 是人类可读合同。

## 状态更新规则

1. 每个阶段开始时把自己的状态改为 `in_progress`。
2. 产物通过本阶段检查后改为 `passed`。
3. 证据不足但可以人工判断时使用 `needs_review`。
4. 缺少关键输入且不能继续时使用 `blocked`。
5. 只有主 Skill 可以把整个案例标记为 `passed`。
6. 修正前先复制本轮比较证据到 `validation/iterations/pass-N/`，不静默覆盖历史。

## 最少恢复步骤

1. 读取 `case.json`。
2. 校验所有被索引的 JSON 和跨文件 ID。
3. 检查源文件身份是否仍与记录一致。
4. 找到第一个不是 `passed` 的阶段。
5. 只加载该阶段的 Skill、规格和关键帧。

如果源视频已改变，创建新案例或显式升级来源版本；不要把旧测量结果直接套到新文件。
