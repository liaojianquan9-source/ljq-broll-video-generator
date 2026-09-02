---
name: ljq-broll-video-generator
description: 从参考截图、可选参考视频或已有场景 JSON 生成可编辑的低噪运动参考视频和 Remotion B-roll。适用于抽象画面结构、提取二维运动、复用模板、渲染 MP4 或调用轻量文字入场预设；不负责决定整条口播中哪些句子需要 B-roll。
metadata:
  version: "0.1.0"
---

# LJQ B-roll Video Generator

把视觉参考转成一个可重复修改的 `scene.json`，再由 Remotion 确定性渲染视频。用户不需要编写 JSON、计算坐标或操作 Remotion。

## 核心原则

- Remotion 只负责渲染；参考素材的理解由当前模型和辅助脚本完成。
- `scene.json` 是唯一可编辑真源。PNG、MP4 和质检图片都是派生产物。
- 先确认结构，再确认运动，最后替换真实内容；一次调用可以连续完成，但不得跳过中间检查。
- 只保留影响位置、比例、层级、遮挡、视觉中心或独立运动的元素。
- 测量、目测和默认补全必须在数据里区分，不把推断伪装成精确事实。
- 已支持的画面优先改 JSON；只有出现新的基本元素或运动能力时才改 TSX。
- 一次复刻中的问题优先沉淀为“判断线索和案例”，不要未经验证就升级成所有场景都必须遵守的硬限制。只有格式正确性、安全性或稳定渲染所必需的条件才进入通用校验器。

## 临摹与复刻的思考顺序

处理真实截图或视频复刻时，先读取 [临摹判断方法](references/reconstruction-thinking.md)。核心顺序是：先锁定最终画面，再判断元素和图层关系，随后校准排版，最后添加动效。用户的语言描述用于指出观察方向；当描述与原片存在歧义时，以原片逐帧证据为准。

## 输入路由

### 参考截图或截图加视频

用于创建新场景。先读取 [场景格式](references/scene-format.md)，视频存在时再读取 [参考分析与质检](references/quality-loop.md)。

### 已有 `scene.json`

用于修改、换内容或重新渲染。先运行校验，不重新猜测已确认的结构。

### 已有模板加新素材

复制为新的项目实例，保留模板本体；只替换内容字段、素材路径和用户明确要求的覆盖参数。

## 工作流

1. 第一次使用或环境变化后运行：

   ```bash
   scripts/setup-environment.sh
   ```

2. 建立当前任务输出目录，保存输入来源，不覆盖模板原件。
3. 若输入包含视频切片，运行：

   ```bash
   scripts/prepare-reference.sh <参考视频> <分析目录>
   ```

   先看 Contact Sheet，再看开始、中间、结束帧。参考视频应是一段连续镜头；多个镜头先拆开。
4. 查看原始截图或代表帧，先用稳定结束帧确定最终排版，再确定父级整体运动与内部模块；同时记录画布、元素、百分比位置、层级、分组和一至两个视觉中心。
5. 把二维运动拆成 `x`、`y`、`scale`、`rotation`、`opacity`、`blur`、`reveal` 属性关键帧。一起移动的元素放入父级 `groups`；只有原画确实给字符预设了不同样式时才使用 `segments`。如果文字颜色变化来自与背景的差值合成，整句必须保留为一个 `content`，统一设置 `mixBlendMode: "difference"`，并把活动色块作为独立形状元素。“逐字右下跃入”使用 `textEntrance: {preset: "jump-in"}`，需要调参时读取 [`jump-in` 还原说明](references/jump-in-reconstruction.md)；逐字正文使用 `revealMode: characters`。没有视频依据时使用克制的默认运动，并标记 `evidence: default`。
6. 写出 `scene.json`。默认先使用 `renderMode: reference`，以黑白灰语义元素验证结构与运动。
7. 校验并渲染：

   ```bash
   scripts/render-video.sh <scene.json> <输出.mp4>
   ```

8. 查看渲染脚本生成的 `.qa/` 目录，按 [质量循环](references/quality-loop.md) 检查元信息、开始帧、中间帧、结束帧和 Contact Sheet。
9. 每轮只修复最影响结果的一个根因，然后重新渲染。全部硬性质量门通过才交付。
10. 用户需要真实 B-roll 时，把同一场景切换为 `renderMode: final`，填入真实文字、图片或视频，再走同一质检循环。

## Loop Engineering 停止条件

- 结构、运动、渲染和文件质量全部通过时停止。
- 默认最多自动修正四轮。
- 同一问题连续三轮没有改善时停止，说明缺少的输入、判断或引擎能力，不进行无意义重试。
- 需要新增引擎能力时，先写一个最小测试场景；验证通过后再用于用户项目。

## 输出

每次任务至少保留：

- 原始可编辑 `scene.json`。
- 渲染后的 MP4。
- `<输出名>.qa/ffprobe.json`。
- `<输出名>.qa/start.png`、`middle.png`、`end.png`。
- `<输出名>.qa/contact-sheet.png`。

如果产物准备进入模板库，再增加模板 manifest、来源说明和双内容复用测试。第一稿不在本 Skill 内进行台词选点；该能力由后续台词规划 Skill 负责。
