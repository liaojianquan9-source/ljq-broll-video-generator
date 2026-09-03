# LJQ B-roll Video Generator 第一稿设计

> 历史状态（2026-09-03）：本文记录 v0.1 的实现依据。黑白灰 `reference` 模式、通用 `scene.json` 唯一真源和最多四轮修正不再作为新复刻流程的目标；后续实施以 [`2026-09-03-broll-replica-master-skill-implementation-plan.md`](2026-09-03-broll-replica-master-skill-implementation-plan.md) 为准。

## 目标

创建一个可以从参考截图、可选参考视频和新内容出发，直接生成可检查 MP4 的 Skill。一次调用内部仍保留“理解结构、理解运动、生成 JSON、Remotion 渲染、关键帧质检、修正重渲染”这些节点。

第一稿默认生成低噪运动参考视频，也支持用相同 JSON 渲染带真实文字、图片或视频的 B-roll。台词自动选点不进入本稿。

## 第一性原理

一段二维 B-roll 最少由六类事实组成：

1. 画布：宽、高、帧率和时长。
2. 元素：画面里有什么。
3. 布局：元素在哪里、占多大、谁压住谁。
4. 内容：元素显示什么文字、图片或视频。
5. 运动：元素在什么时间改变位置、缩放、旋转、透明度、模糊或揭示比例。
6. 验证：实际生成的每一帧是否符合前五项。

因此第一稿不把具体参考风格写死成大量 Scene，而是先实现一个通用二维元素和关键帧引擎。所有可编辑事实写进 `scene.json`，Remotion 只负责把事实变成帧。

## 方案选择

### 方案 A：每种参考图编写一个 TSX

优点是单次自由度最高；缺点是无法形成稳定模板库，每次都要改代码。不采用为主流程。

### 方案 B：大量预设名称驱动

优点是 JSON 短；缺点是遇到参考视频里的新运动时需要不断新增预设，容易过拟合。不作为底层格式。

### 方案 C：元素 + 属性关键帧

把运动拆成 `x`、`y`、`scale`、`rotation`、`opacity`、`blur`、`reveal` 七种基本变化。大部分二维 B-roll 都能用这些基本变化组合。后续可以在不改变底层格式的前提下增加上层预设。

选择方案 C。

## 架构

```text
参考截图/参考视频
  -> AI 视觉判断与抽帧辅助
  -> scene.json
  -> JSON 校验
  -> Remotion 通用场景引擎
  -> MP4
  -> ffprobe + 关键帧 + Contact Sheet
  -> AI 视觉复核
  -> 修改 JSON 后重渲染
```

## 组件

- `SKILL.md`：一次调用的路由、工作流和停止条件。
- `references/scene-format.md`：稳定 JSON 数据契约。
- `references/quality-loop.md`：从草稿到通过的循环质检标准。
- `scripts/prepare-reference.sh`：读取参考视频信息，生成代表帧和 Contact Sheet。
- `scripts/setup-environment.sh`：检查系统命令并安装项目本地依赖。
- `scripts/validate-scene.mjs`：不启动 Remotion 就能发现 JSON 结构错误。
- `scripts/render-video.sh`：校验、渲染、ffprobe 检查并生成质检图片。
- `assets/remotion-renderer/`：通用 JSON 驱动 Remotion 项目。
- `assets/examples/`：不依赖外部素材的可运行示例。

## 两种渲染模式

### `reference`

所有元素变成低噪黑白灰语义块，只保留强调色、标签、层级和运动。用于人工质检和下游模型参考。

### `final`

文字显示真实内容，图片和视频读取真实素材，形状和连线使用项目颜色。用于模板复用后的确定性 B-roll。

两种模式共用位置和运动。这样可以先确认低噪运动，再切换成真实内容，不重新猜动画。

## Loop Engineering

每轮只处理一个最主要的问题：

1. 根据输入创建或修改 JSON。
2. 静态校验。
3. 渲染视频。
4. 检查视频元信息。
5. 查看开始、中间、结束帧和 Contact Sheet。
6. 对照参考，定位最影响结果的问题。
7. 只修改该问题对应的布局或运动字段。
8. 重复，直到通过全部硬性质量门。

默认最多自动修正四轮。若同一问题连续三轮仍未改善，停止并说明缺少的素材、判断或引擎能力，避免无意义循环。

## 第一稿边界

支持元素：`shape`、`text`、`image`、`video`、`line`。

支持运动：位置偏移、缩放、旋转、透明度、模糊和揭示；支持多关键帧插值和简单周期摆动。

暂不支持：三维摄像机、复杂粒子、自由曲线路径、角色骨骼、自动台词选点、自动语义素材搜索。

## 验证

1. Skill 结构通过 `quick_validate.py`。
2. 示例 JSON 通过 `validate-scene.mjs`。
3. 示例能实际渲染 H.264 MP4。
4. `ffprobe` 能读取正确的画幅、帧率和时长。
5. 自动生成开始、中间、结束帧和 Contact Sheet。
6. 人工查看关键帧，确认元素出现顺序、层级、位置和运动没有明显错误。
