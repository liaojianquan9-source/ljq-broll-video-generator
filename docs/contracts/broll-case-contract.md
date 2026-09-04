# B-roll 复刻案例交接合同 1.2

主 Skill 与三个子 Skill 通过同一案例目录交接。JSON Schema 与 `validate-case.mjs` 是机器真源；本文说明人类可读边界。

## 文件与责任

| 文件 | owner | 内容 |
| --- | --- | --- |
| `case.json` | 主 Skill/当前阶段 | 范围、来源、阶段、索引、修正次数 |
| `evidence/source.json` | preflight | 来源哈希、媒体元信息、抽帧证据 |
| `specs/layout.json` | layout | 逐场景落定帧、稳定 ID、几何、裁切、字体、外观、替换测试 |
| `specs/motion.json` | motion | 逐元素动画、连续曲线、揭示/文字行为、连续性证据 |
| `remotion/composition.tsx` / `schema.ts` | layout/implementation | 可编辑组合入口与可替换 props |
| `validation/gates.json` | QA | live 元素和排除区域的人工检查证据 |
| `validation/report.json` | QA | 自动门、视觉结论、问题归因和比较证据 |

JSON 是跨阶段合同；TSX 是实际可编辑实现。可拆文字、媒体、形状和容器不得被压成参考截图。

## 范围合同

`case.json.scope` 必须记录：

- `startSeconds`、`endSeconds`、`durationSeconds`；
- 用户要保留的 `include` 和不做的 `exclude`；
- 有排除项时的 `excludedRegionMode` 与可选 `exclusionMask`；
- 最终范围确认语句 `confirmation`。

案例内 `files.source` 必须是按此范围精确裁切的可移植副本。解码时长与合同相差不得超过一帧。`source.path` 保留原始绝对路径作为来源记录。

## 阶段文件

尚未开始的下游文件在 `case.json.files` 中为 `null`。阶段通过后必须存在：

- `preflight=passed`：精确裁切源片、source evidence、范围合同；
- `layout=passed`：layout、composition、props schema、所有场景三联 still、必需替换 still；
- `motion=passed`：motion 与通过的 continuity evidence；
- `implementation=passed`：可编辑源码与完整 render；
- `qa=passed`：render、QA gates 与 status=passed 的 report。

`--complete` 要求全部五阶段、案例根状态和所有必需证据通过。

## 布局合同

`layout.scenes[]` 为每个排版场景保存时间范围、落定帧、source/render/comparison still、状态和观察。元素通过 `sceneId` 属于场景。

`bounds` 为画布百分比 `[left, top, width, height]`，可以越界；`anchor` 为元素内部 0..1。元素记录类型、内容/素材、父组、zIndex、裁切、来源/完整性、外观、证据和置信度。

文字元素保留 Top 3 `fontCandidates`；只有存在可证明的精确字体时可用单一 `exact: true` 候选。每个 `replaceable: true` 元素必须有通过的 `replacementTests[]`。

## 动效合同

平移使用像素，缩放使用倍率，旋转/色相使用度，透明度和 reveal 使用 0..1，帧号为从 0 开始的整数。

schema 1.2 的空间轨道使用一个 curve 对象：两个 endpoint keyframe、`linear|bezier` interpolation 与可选 cubic bezier。密集测量点存于 evidence，不用于分段重启缓动。设计性反向或停留显式使用 `allowReversal` / `allowHoldFrames`。

runtime 有明确支持的方向 reveal 和文字 preset。schema 1.2 不允许用 `custom` 绕过未实现能力。所有动作绑定 layout ID，或 `@camera`、`@scene`、`@transition`。

## QA 合同

schema 1.2 的通过报告必须包含：

`dimensions`、`fps`、`frame-count`、`audio`、`scope`、`live-elements`、`replacement-smoke`、`settled-scenes`、`motion-continuity`、`excluded-regions`、`visual-fidelity`。

只有合同允许的 `replacement-smoke` 和 `excluded-regions` 可以是 `not_applicable`。人工门必须由 `validation/gates.json` 提供存在于案例内的证据。

## 证据与置信度

- `measured`：脚本、像素或时间码测得；
- `observed`：从全分辨率帧可直接观察；
- `inferred`：从结果推断的可复现实现；
- `default`：缺证据时使用的克制默认值。

置信度为 high/medium/low。字体、混合模式、原插件和隐藏像素不能从压平视频唯一恢复时，不得伪装成 high 置信度测量。

## 修正与校验

初版为 pass 0，`maxCorrections=2`。必须通过 `begin-correction.mjs` 归档上一轮并增加计数。第三次修正被拒绝；届时保留已知差异或请求新证据。

```bash
node scripts/validate-case.mjs /absolute/path/to/case-directory
node /path/to/ljq-broll-replica/scripts/validate-case.mjs /absolute/path/to/case-directory --complete
```

根目录 schema 与主 Skill 内 schema 由 `scripts/sync-schemas.sh` 保持一致。
