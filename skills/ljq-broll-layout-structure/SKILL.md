---
name: ljq-broll-layout-structure
description: "从已预检的 B-roll 案例中选择入场完成、出场开始前的关键落定帧，拆成稳定元素 ID，并用 Remotion 复刻为分层、可编辑的最终排版构图。用于建立后续动效复刻的准确终点，校准位置、比例、裁切、遮挡、字体占位、混合模式和层级；不生成黑白灰结构图或参考图，也不负责完整入场、出场或转场。"
metadata:
  version: "1.1.0"
---

# B-roll 落定帧可编辑排版

把一个已经过预检的案例目录变成可交接的静态构图。`specs/layout.json` 是跨 Skill 合同，`remotion/composition.tsx` 与 `remotion/schema.ts` 是可编辑实现。三者必须表达同一组稳定元素 ID。

## 开始前

1. 阅读案例目录的 `case.json` 与 `evidence/source.json`，确认 `preflight` 已通过。
2. 阅读 [references/visual-grammar.md](references/visual-grammar.md)、[references/asset-recovery.md](references/asset-recovery.md) 和 [references/static-compositing.md](references/static-compositing.md)。批量处理时再读 [references/batch-workflow.md](references/batch-workflow.md)。
3. 使用 Remotion 插件的 `remotion-best-practices`、`remotion-markup`、`remotion-interactivity`；需要渲染验收帧时再使用 `remotion-render`。
4. 读取主 Skill 自带的 `schemas/layout.schema.json`。不要自创第二套字段或元素名称。

## 输入合同

必须接收一个案例目录，而不是依赖聊天中的模糊位置描述。案例至少包含：

- `case.json`
- `files.source` 指向的案例内原片
- `files.sourceEvidence` 指向的元信息与全分辨率关键帧

若用户只给视频，先返回主 Skill 运行预检；不要在本 Skill 中悄悄建立不兼容案例。

## 工作流

1. 为每个排版场景选择一个“主要入场已完成、退出尚未开始、信息关系最完整”的落定帧。不是机械中点。证据不足时可补抽相邻全分辨率帧。
2. 把画面拆成真正需要独立定位、替换、遮挡或后续运动的元素。为它们创建稳定、小写连字符 ID；后续 Skill 不得重命名。
3. 测量百分比边界 `[left, top, width, height]`、锚点、父组、层级和裁切。越界元素保留真实越界关系。
4. 先判断元素是完整素材、可见区域提取，还是仅由容器/画布裁切。需要提取时保存到案例 `assets/extracted/`，记录来源和完整性；不做生成式补全。普通文字、数字、参数和可替换标题不得从参考帧提取为生产贴图。
5. 记录颜色、透明度、混合模式、滤镜、模糊、阴影、圆角、媒体适配和字体占位。按字体组执行候选匹配，保存 Top 3 轮廓对比；无法唯一识别字体或混合方式时标为 `inferred` 或 `default`，不能伪装成测量值。
6. 写入 `specs/layout.json`。内容必须通过主 Skill 的 Layout Schema。
7. 写入 `remotion/composition.tsx` 和 `remotion/schema.ts`。组件默认状态必须等于落定帧；可替换文案、媒体、数字和主题色暴露为 props。
8. 为每个排版场景用 Remotion 渲染落定帧，与原始落定帧并排或叠放校准。优先修正画布/裁切、主体边界、层级、留白、文字轮廓，再修材质、描边和辉光。
9. 对每类 `replaceable: true` 元素做一次替换 still：文字换成长短不同的内容、数字改变位数、图片换不同宽高比。替换后不得露出旧像素或旧字形。
10. 所有场景的静帧与替换门通过后，更新 `case.json.files.layout`、`composition`、`propsSchema`，把 `stages.layout` 设为 `passed`。运行主 Skill 的 `scripts/validate-case.mjs <case-dir>`。

## 元素与实现约束

- 一个元素只在“需要替换、独立运动、独立遮挡或定义容器”时拆出；实拍内部普通物体不自动分层。
- 不把可拆构图压成整帧背景。原画本身就是不可拆实拍或合成素材时，才可作为单个媒体层。
- `evidence/`、Contact Sheet 和参考关键帧不能作为运行时可见资产。普通文字若使用截图、视频裁片或 alpha 像素贴图，布局直接失败；固定官方字标只能作为 `type: image` 且明确 `replaceable: false`。
- 主要元素使用与稳定 ID 对应的可辨识组件名和 `data-element-id`；在 Studio 可用时使用 `Interactive.*`。
- 位置、尺寸和常用样式保持直观可编辑。不要把所有几何量隐藏在难以追踪的函数或一长串 transform 中。
- 组负责共同位移和裁切，子元素负责内部排版与替换内容。
- 字体无法从压平视频被唯一确认。按中文标题、数字、单位、拉丁字母和手写标注分别匹配，以轮廓、负空间、笔画端点、字宽、行高、字重、字距和基线为依据；保存候选字体、来源、许可与置信度。
- 水印或平台标识默认不进入复用元素，除非用户明确要求。

## 输出与边界

必须产生：

- `specs/layout.json`
- `remotion/composition.tsx`
- `remotion/schema.ts`
- 必要的 `assets/originals/`、`assets/extracted/` 或经授权的外部素材副本
- 可选的 `evidence/layout-settled-source.png`、`evidence/layout-settled-render.png` 与叠放检查图
- 字体候选与替换冒烟测试证据

不要生成黑白灰结构图，不要创建 AI 风格参考图，不调用图像生成模型。不要在本阶段发明入场、出场、弹跳、转场或特效曲线；把静态终点交给 `$ljq-broll-motion-forensics`。
