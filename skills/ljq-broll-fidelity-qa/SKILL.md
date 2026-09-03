---
name: ljq-broll-fidelity-qa
description: "对 B-roll 参考片与 Remotion 完整渲染做保真验收，核对画幅、fps、帧数、音频、落定帧、关键时间节点和逐帧视觉差异，输出 validation/report.json 与比较证据并把问题归因到 preflight/layout/motion/implementation。用于决定通过或进入最多两轮定向修正；不直接跨阶段改源码。"
---

# B-roll 保真 QA

QA 负责比较、判断和归因，不负责顺手重写布局或动效。指标是定位线索，不存在适用于所有独立重建案例的万能像素阈值。

## 开始前

1. 读取 `case.json`、layout、motion 和完整 render；`implementation` 必须通过。
2. 阅读 [references/quality-gate.md](references/quality-gate.md)。
3. 使用主 Skill `.venv/bin/python` 运行本 Skill 脚本。
4. 先跑 `scripts/qa-case.py <case-dir>` 生成逐帧证据，再检查 comparison 图、最差帧和原/渲染视频。

## 验收顺序

1. 硬门：源文件身份、画幅、fps、解码帧数、时长与音频是否匹配预期。
2. 落定状态：元素是否缺失/重复，主体边界、位置、裁切、层级、遮挡、留白和字体占位。
3. 时间行为：首次出现、落定、退出、方向、锚点、整体镜头、转场和关键特效。
4. 完整播放：闪帧、尾帧、遮罩穿帮、字体加载、媒体解码和编码异常。
5. 次要外观：混合、模糊、阴影、纹理和压缩差异。

## 判定

- 自动脚本先生成 `validation/report.json`，默认 `pending`，因为像素差异不能替代视觉判断。
- 完整检查后运行 `qa-case.py <case-dir> --visual-status pass --observation "..."` 才能通过。
- 明显偏差使用 `--visual-status fail --owner layout|motion|implementation --observation "..."`。每次只选择最高影响根因或同一根因的一组问题。
- QA 不增加修正次数。主 Skill 使用自己的状态脚本开始下一轮。
- 两轮后仍有差异时，记录 `knownDifferences` 或阻塞原因，不无限循环。

## 归因

- 来源/镜头/帧数本身错：`preflight`
- 元素、素材、位置、尺寸、裁切、层级、字体占位、静态混合错：`layout`
- 首次出现、落定、退出、方向、缩放对象、缓动、转场错：`motion`
- 规格正确但浏览器渲染、字体加载、遮罩、媒体或编码错：`implementation`
- 比较未对齐或报告本身错：`qa`

## 输出

保存 `validation/report.json`、逐帧原始指标、并排比较图和每轮证据目录。报告必须使用稳定元素 ID 指向具体问题；不能只说“感觉不像”。
