---
name: ljq-broll-motion-forensics
description: "对已通过落定布局的连续 B-roll 做逐元素动效取证，分开场景、镜头、元素和文字内部行为，并输出可验证的连续 motion.json。用于入场、出场、缩放、擦开、叠影和转场取证；不重新排版或猜测原软件参数。"
metadata:
  version: "1.2.0"
---

# B-roll 动效取证

围绕已确认的静态终点，逐元素回答“什么时候出现、怎样到达、是否持续收束、怎样离开”。同时出现不代表共享同一动画。

## 开始条件

1. 读取 `case.json`、`evidence/source.json`、`specs/layout.json` 和每个场景的落定 still；`preflight`、`layout` 必须为 `passed`。
2. 读取 [references/measurement-guide.md](references/measurement-guide.md) 和主 Skill `schemas/motion.schema.json`。
3. 使用主 Skill `.venv/bin/python` 运行 Python 取证脚本。

## 工作流

1. **抽全分辨率帧。** 按需运行 `scripts/extract-analysis-frames.sh <case-dir>`。细线、小字和斜向擦开不能只看缩略图。
2. **写逐元素行为表。** 每个稳定 ID 分别记录 firstVisible、settledFrame、endFrame、方向、anchor、遮罩、模糊、亮度、辉光、残影与收束尾巴。
3. **分轨取证。** 场景显隐、`@camera` 整体缩放、元素 transform、reveal、effects 和 textAnimation 分别成轨。只有轨迹证据一致时才放入共同父组。
4. **区分可见行为。** 使用 `motion_track.py`、`element_timeline.py` 和 `edge_trace.py` 区分平移/旋转、显影/擦开、逐字/散开。方向擦开必须记录前沿方向；叠影必须记录层数、间距、错峰、模糊与纵向拉伸。
5. **拟合连续曲线。** 新版空间轨使用两个端点和一条全程 curve，测量中间点保留在 evidence，不把同一 easing 在每个采样点重启。例如：

   ```json
   {"keyframes":[{"frame":0,"value":80},{"frame":18,"value":0}],"interpolation":"bezier","bezier":[0.22,1,0.36,1]}
   ```

   只有证据表明过冲/回弹或设计性停留时，才分成语义上独立的 motion 或显式允许 reversal/hold。
6. **表达特效。** 共享 runtime 支持水平/垂直/斜向 reveal 以及 `ghost-drop-in`。新版合同禁止用 `custom` 伪装尚未实现的能力；缺能力时先扩展 runtime 并添加渲染测试。
7. **运行连续性分析。**

   ```bash
   node /path/to/ljq-broll-replica/scripts/analyze-motion-continuity.mjs <case-dir>
   ```

   它会生成 `evidence/motion/continuity.json` 并回写 `motion.continuity`。无意重复帧、意外反向、中途近停后跳动或速度尖峰均不得通过。
8. **交付动效。** `motion.continuity.status=passed` 后才设置 `stages.motion=passed`，然后运行主 Skill 校验器。

## 边界

- 所有 `targetId` 必须来自 layout，或为 `@camera`、`@scene`、`@transition`。拆分错误返回 layout。
- 落定值回到布局默认状态。整体镜头绑定 `@camera`，不复制到每个子元素。
- 剪映、AE 预设名只是语义线索，方向、时长、层数、错峰和收束必须从原片取证。
- 随机文字效果使用固定 `seed`。不修改静态 bounds、素材、层级或字体。

## 完成标准

`specs/motion.json` 的每个动作都有稳定目标、时间窗、可执行行为、证据和置信度；`motion.continuity` 已通过；主 Skill 校验器通过。
