# 静帧与复用门

本文定义新版 layout 合同中必须留下的可验证产物。素材判断和字体方法由 `$ljq-broll-layout-structure` 的 `asset-recovery.md` 与 `static-compositing.md` 负责；动线连续性由 `$ljq-broll-motion-forensics` 负责。

## 逐场景静帧

`layout.scenes[]` 中的每个排版场景必须有：

- 独立 `id`、`startFrame`、`endFrame` 和 `settledFrame`；
- 原片落定帧 `sourceStill`；
- Remotion 落定帧 `renderStill`；
- 并排或叠放图 `comparisonStill`；
- 实际观看后的 `status` 与 `observation`。

核对顺序为：画布/裁切 → 主体边界与比例 → 位置/层级/留白 → 字体轮廓 → 渐变/描边/辉光/纹理。任一场景未通过时，`layout` 不得设为 `passed`。

## 可编辑边界

- 参考帧、Contact Sheet、裁切观察图、差异图、边缘图和轨迹图仅作为 evidence，不得进入运行时可见层。
- 文字、数字、参数、标题、线条、框、遮罩和可替换图形必须为 live text、SVG、CSS 或可编辑组件。
- 固定官方字标可作为 `type: image`、`replaceable: false`；用户要求换字时不适用此例外。
- 文字元素必须有 `fontCandidates`。默认保留 Top 3；只有单一候选有足够证据且 `exact: true` 时可少于三个。

## 替换冒烟

每个 `replaceable: true` 元素必须在 `layout.replacementTests[]` 中有一项对应测试，记录 elementId、variant、renderStill、status 和 observation。测试值要能暴露泄漏：

- 文字替换为长度明显不同的字符串；
- 数字改变位数；
- 媒体替换为不同宽高比；
- 主题色改变。

替换后如果出现旧字形、旧数字、旧辉光轮廓或旧素材像素，该测试失败。默认 props 恢复后才进行最终完整渲染。

## 完成标准

所有场景和必需替换测试为 `passed`，相关图片存在，且主 Skill 校验器通过。
