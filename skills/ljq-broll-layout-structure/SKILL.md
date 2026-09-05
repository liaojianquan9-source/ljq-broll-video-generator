---
name: ljq-broll-layout-structure
description: "把已预检的 B-roll 案例拆成逐场景、稳定元素 ID 和可编辑 Remotion 落定布局，并用原片/渲染/比较 still 与替换 still 证明静帧和复用性。用于复刻入场完成后的终点画面；不分析完整动线。"
metadata:
  version: "1.3.0"
---

# B-roll 落定布局

先证明每个场景的最终定帧对得上，再交给动效阶段。`specs/layout.json`、Remotion 组件和 props schema 必须使用同一组元素 ID。

## 开始条件

1. 读取 `case.json`、`evidence/source.json` 和 `scope`；`preflight` 必须为 `passed`。
2. 读取 [references/visual-grammar.md](references/visual-grammar.md) 和 [references/asset-recovery.md](references/asset-recovery.md)。测量静帧、校准配色/字体/材质、判断蒙版或替换结果前，必须读取 [references/static-compositing.md](references/static-compositing.md)；它是静态视觉判断的唯一规则来源。批量案例再读 [references/batch-workflow.md](references/batch-workflow.md)。
3. 读取主 Skill 的 `schemas/layout.schema.json`。需要 Remotion 实现或导出时，使用对应的 Remotion Skill。

只接收案例目录。用户只给原片时，返回主 Skill 完成范围预检。

## 工作流

1. **分场景。** 对每个排版状态选择“主要入场已完成、退出尚未开始”的落定帧，写入 `layout.scenes[]`。不选机械中点。
2. **拆元素。** 先读取 [references/element-taxonomy.md](references/element-taxonomy.md)，按对象类型与共享/专属属性两轴分析。需要替换、独立定位、裁切、遮挡或运动时才拆层。为元素写入稳定的小写连字号 ID 和 `sceneId`，适用属性与未知项均可追溯。
3. **建立静态终点。** 测量百分比 bounds、anchor、parentId、zIndex、裁切和静态 appearance；按 [静态视觉判断](references/static-compositing.md) 核对实际可见比例、颜色角色和合成关系，并区分观察与推测。
4. **建立可编辑实现。** 文字、数字、参数、线条、框和遮罩使用 live text、SVG、CSS 或可编辑组件。可替换内容暴露为 props。
5. **完成字体证据。** 中文、数字、单位、拉丁字母分组匹配。无法确认精确字体时保留 Top 3 `fontCandidates`及轮廓比较；只有可证明精确时才使用单一 `exact: true` 候选。
6. **逐场景渲染证据。** 已有批准still或composition已接动效时，先按总控的[执行手册](../ljq-broll-replica/references/execution-playbook.md#静态基准与动态实现交接)导出独立probe，保护原基准。新建正式场景证据时，对每个 `sceneId` 运行：

   ```bash
   /path/to/ljq-broll-layout-structure/scripts/render-layout-scene.sh <case-dir> <scene-id>
   ```

   脚本会覆盖目标source/render/comparison still并回写`scenes[]`为needs_review；它不自动关闭动效。实际观看后才登记passed与具体observation；需要用`--pass --observation`重跑登记时，先确认props、源码和目标路径与已看证据相同。
7. **替换冒烟。** 按 [替换冒烟与视觉验收](references/static-compositing.md#替换冒烟与视觉验收) 区分机制、适配风险和正式配色证据。对每个 `replaceable: true` 元素准备 props JSON，运行：

   ```bash
   /path/to/ljq-broll-layout-structure/scripts/render-replacement-still.sh <case-dir> <element-id> <props.json>
   ```

   此脚本会覆盖replacement文件/条目；动态实现的静态替换props须明确关闭动效。看过结果后再登记通过，不能以命令成功代替观察。
8. **交付布局。** 只有所有 `scenes[].status` 和必需 `replacementTests[].status` 为 `passed` 时，才把 `stages.layout` 设为 `passed`并运行主 Skill 校验器。

## 边界

- 参考帧、Contact Sheet、裁切观察图和差异图只能存在于 `evidence/` 或 `validation/`，不得成为运行时可见层。
- 不把可拆构图压成整帧背景。原画本就是不可拆实拍素材时，可作为单个媒体层。
- 静态 appearance 与动态 effects 的归属和收束值按 [静态视觉判断](references/static-compositing.md#静态-appearance-与动态-effects)。
- 本阶段不发明入场、退出、弹跳、转场或动效曲线，不调用图像生成。

## 完成标准

`specs/layout.json`、`remotion/composition.tsx`、`remotion/schema.ts`、逐场景三联 still、字体候选和必需替换 still 全部存在，且主 Skill 校验器通过。
