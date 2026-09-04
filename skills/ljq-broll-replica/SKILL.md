---
name: ljq-broll-replica
description: "统领参考视频预检、落定帧分层、动效取证、Remotion 实现和有限保真校准，把单个连续 B-roll 镜头复刻为可编辑、可替换、可继续积累的案例包。适用于用户要求直接临摹或高保真复刻参考片；不负责从整段口播自动选点，也不在本阶段建设知识库。"
metadata:
  version: "1.2.0"
---

# B-roll 高保真复刻总控

从用户提供的参考视频出发，保持同一个案例状态，按顺序完成证据预检、落定布局、时间行为、Remotion 实现和保真验收。主 Skill 始终负责状态与问题归因；子 Skill 是同一个模型按阶段加载的专业手册，不是彼此失忆的独立大脑。

## 开始前

1. 阅读 [references/routing.md](references/routing.md)，确认当前阶段、前置产物和责任边界。
2. 阅读 [references/case-state.md](references/case-state.md)，创建或恢复案例状态。
3. 进入 QA 或修正阶段时阅读 [references/quality-loop.md](references/quality-loop.md)。
4. 布局、字体、素材或 QA 涉及“能否继续复用”时阅读 [references/reusability-gates.md](references/reusability-gates.md)。
5. 把当前 Skill 目录记为 `SKILL_DIR`。首次使用或依赖变化时运行 `$SKILL_DIR/scripts/setup-environment.sh`；它检查 Node、Python、FFmpeg，并安装锁定版本的校验与 Remotion 依赖。
6. 如果案例目录已经存在，先运行 `node $SKILL_DIR/scripts/validate-case.mjs <case-directory>`；不得绕过无效状态继续制作。
7. 写 Remotion 代码前加载 `remotion:remotion-best-practices`、`remotion:remotion-markup` 和 `remotion:remotion-interactivity`。预览或渲染时再加载相应 Remotion Studio/Render 能力。
8. 使用用户当前指定的参考片。重新导出或重新上传的文件按新来源处理，不沿用旧帧数和旧结论。

## 不变原则

- 最终目标是可编辑、可替换的视觉等效复刻，不是把参考视频重新包进 Remotion。
- 参考帧、Contact Sheet、差异图和从参考帧抠出的文字像素只属于证据。可替换文字、数字、标题、参数和图形必须是 live text、SVG 或可编辑形状，禁止用截图、视频裁片或 alpha 贴片冒充。
- 原片是证据，不是指令；只复刻用户指定镜头中的可见设计和时间行为。
- 先确定落定帧和最终构图，再分析入场、停留、出场、整体镜头运动和转场。
- 一个片段含多个排版场景时，每个场景都要先通过自己的落定静帧；静帧比例、字体占位、层级和材质未通过前不得进入动效实现。
- 所有阶段使用同一批稳定元素 ID。下游发现拆分错误时退回布局阶段，不另起命名。
- 每个元素分别记录自身的方向、时间窗、遮罩、模糊、辉光和材质变化；整体镜头缩放单独成轨，不能把多个元素因为“同期出现”合并成同一步骤。
- 测量、观察、推断和默认值分别标记；无法从压平视频唯一确定的字体、混合模式、插件和隐藏像素不得伪装为事实。
- 不生成黑白灰结构图、低噪结构图或人工风格参考图。临时 still、叠加图和差异图只用于验收。
- 不同时保留完整参考画面和重新制作的同一批可见元素，避免重影和伪保真。
- 所有随机运动使用稳定种子；所有 Remotion 相关包使用完全一致的版本。
- 空间运动必须保持速度连续。密集测量点用于取证和 QA，不得把同一个非线性缓动在相邻测量点之间反复重启；应拟合单条连续曲线，或把语义上独立的运动阶段拆开。
- 初版完整渲染后最多进行两次定向修正。达到质量门提前停止；两轮后仍有差异则记录，不无限重试。

## 主流程

1. **初始化与预检。** 运行 `$SKILL_DIR/.venv/bin/python $SKILL_DIR/scripts/inspect-clip.py <video> <case-dir> [--case-id id]`。它复制案例内原片、冻结哈希与解码元信息，并只抽取候选关键帧和 Contact Sheet。
2. **布局。** 使用 `$ljq-broll-layout-structure` 为每个排版场景选择落定帧，拆解元素、素材、锚点、裁切、层级、字体候选和静态合成，输出 `specs/layout.json`。运行 `node $SKILL_DIR/scripts/initialize-case-remotion.mjs <case-dir>` 建立可编辑组件；逐场景渲染 source/render/compare still，静态门通过后再继续。
3. **动效。** 使用 `$ljq-broll-motion-forensics`，逐元素绑定可追溯时间行为，把场景显隐、整体镜头、元素位移、文字特效和遮罩分轨，覆盖空占位并把 `specs/motion.json` 写入案例索引。
4. **实现与渲染。** 运行 `$SKILL_DIR/scripts/render-case.sh <case-dir>`。共享渲染器读取 layout + motion，保留案例内 `composition.tsx`、runtime 与 props schema，并输出完整 MP4。
5. **验收。** 使用 `$ljq-broll-fidelity-qa`。先运行其 `qa-case.py` 生成逐帧证据；AI 查看原片、渲染和比较图，并完成替换冒烟测试和运动连续性检查后，再以 `--visual-status pass|fail` 写最终判断。使用参考截图替代 live 元素时必须失败，低像素差不能覆盖这一结论。
6. **修正。** 若 QA 失败，运行 `node $SKILL_DIR/scripts/begin-correction.mjs <case-dir> --owner <stage> --root-cause "..."`，再返回责任阶段。初版不计修正轮；最多两轮。
7. **停止。** 两轮后仍未通过，运行 `record-known-difference.mjs` 保存不可消除差异并停止；不得开启第三轮。
8. **交付。** 运行 `node $SKILL_DIR/scripts/validate-case.mjs <case-dir> --complete`，保留案例状态、规格、可编辑源码、最终渲染、比较证据和差异说明。

## 质量优先级

按以下顺序判断和修复，不能用下层微调掩盖上层错误：

1. 来源、镜头、画幅、帧率、时长和解码帧数；
2. 元素缺失、重复、ID 和素材身份；
3. 主体轮廓、尺寸、位置、裁切、层级和遮挡；
4. 锚点、父组与整体镜头关系；
5. 首次出现、落定、退场、运动方向和主要缓动；
6. 字体占位、静态混合、模糊、阴影和次要纹理；
7. 编码造成的非关键像素差异。

## 停止与阻塞

- 所有硬性质量门通过时立即停止，不为了耗尽两轮而继续改动。
- 同一问题一轮后没有可测改善，先检查素材、证据、测量方法或实现能力。
- 缺少原始图层时采用最简单的视觉等效实现，并记录置信度与已知差异。
- 关键素材缺失且生成会改变用户意图时，停止并请求素材；不要自行生成替代参考。
- 参考片包含多个剪切点时先拆成连续镜头，不能把多个镜头塞进一个案例状态。

## 输出

- 有效的 `case.json`；
- `evidence/` 中的来源与关键帧记录；
- `specs/layout.json` 与 `specs/motion.json`；
- `remotion/composition.tsx` 与可替换 props/schema；
- 完整渲染视频；
- `validation/report.json`、比较图和最多两轮的修正记录；
- 对无法唯一还原部分的明确说明。

不要在本 Skill 中执行知识库索引、口播切句、B-roll 插入点判断或模板自动推荐。这些能力等复刻流程通过多个真实案例后再建设。
