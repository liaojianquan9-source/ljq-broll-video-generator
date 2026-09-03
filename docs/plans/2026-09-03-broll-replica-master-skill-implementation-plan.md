# B-roll 高保真复刻主 Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 先跑通“参考视频 → 可编辑 Remotion 高保真复刻 → 有限循环验收”的完整流程，并把知识库与口播自动调用明确延后到复刻流程稳定之后。

**Architecture:** 对外提供一个 B-roll 复刻主 Skill，由主 Skill 保持任务状态、按阶段路由子 Skill，并通过同一个案例目录和稳定元素 ID 交接。布局、动效取证、Remotion 实现和保真验收各自独立负责一个可验证阶段；详细方法按需加载，测量和比较尽量由本地脚本完成。

**Tech Stack:** Codex Skills、Remotion/React/TypeScript、FFmpeg/ffprobe、Python、Pillow、NumPy、JSON、Zod。

---

## 0. 文档状态

- 日期：2026-09-03
- 状态：方向已确认，已开始分批实施
- 项目根目录：`/Users/liaojianquan/Documents/07_开发项目/AI剪辑_B-Roll`
- 当前优先级：先完成复刻闭环，不建设正式知识库，不开发口播自动选点
- 实施边界：先完成复刻主链路；真实案例验收等待用户随后提供参考片

## 1. 第一性原理

最终目标不是为了复刻而复刻，而是从优秀参考视频中提取可复用的视觉表达方式，未来根据新的口播内容调用这些方式，让观众更容易理解、关注和记住信息。

完整目标链路是：

```text
优秀参考片
→ 高保真复刻
→ 提取可编辑元素、布局和运动
→ 形成经过验证的案例
→ 后续建立知识库
→ 根据新口播识别视觉表达机会
→ 调用案例并替换内容
→ 生成帮助理解的新 B-roll
```

当前阶段只完成前半段：

```text
优秀参考片
→ 高保真复刻
→ 一至两次有目标的比较修正
→ 形成结构完整、以后可入库的案例包
```

## 2. 已确认的产品决策

1. 采用“一个主 Skill 统领多个子 Skill”的方案。
2. 主 Skill 解决完整的 B-roll 复刻问题，子 Skill 解决可以独立验收的专业阶段。
3. 子 Skill 不是彼此隔离的任务；主 Skill 始终保持控制，并使用共同案例状态交接。
4. 不再生成黑白灰结构图、低噪结构图或人工风格参考图。
5. 原视频中的落定帧是静态复刻依据；Remotion 可编辑组件是最终视觉实现。
6. 先锁定落定帧和最终布局，再分析入场、停留、出场、整体缩放和转场。
7. 素材完整但位于画布外时保留完整素材，通过位置与画布边界裁切，不进行破坏性裁图。
8. 仅凭压平视频无法恢复的隐藏区域不得伪装成原始素材；生成式补全只能标记为推断版本。
9. 字体名称不要求百分之百识别，优先匹配字宽、字重、字号、行高、字距、换行和总占位。
10. 测量、视觉观察、推断和默认补全必须分开记录，并附置信度。
11. 使用 Remotion 插件提供的能力，不在自己的 Skill 中复制整套 Remotion 通用文档。
12. 默认最多进行两次有针对性的视觉修正，不执行无边界循环。

## 3. 与旧文档的关系

以下旧文档保留为历史记录，但其中部分路线已被本计划替代：

- `docs/plans/2026-09-02-ljq-broll-video-generator-design.md`
- `docs/plans/2026-09-02-broll-denoised-reference-library-prd.md`
- `skills/ljq-broll-video-generator/SKILL.md`
- `skills/ljq-broll-video-generator/references/quality-loop.md`

被替代的旧决策：

- “黑白灰 reference 模式”不再作为新复刻流程的中间产物。
- 不再生成低噪结构图供 AI 二次猜测位置。
- 旧的“最多四轮、同一问题三轮无改善”改为最多两次有目标的修正。
- 不再把通用 `scene.json` 当作所有视觉实现的唯一真源。
- 不要求先建设模板库再证明复刻质量。

仍然保留的旧经验：

- 先终点、后运动。
- 元素 ID 跨阶段保持一致。
- 区分父级整体运动和子元素局部运动。
- Contact Sheet 用于理解时间结构。
- 测量与推断分开。
- Remotion 负责确定性实现和渲染。
- 每个阶段必须能够独立定位错误。

实施本计划时，应先在旧文档顶部增加“历史方案/已被新计划部分替代”的说明，不立即删除旧文档。

## 4. 外部参考的吸收原则

研究输入：

- `remotion-skills.zip`
- `fidelity-first-broll-skill.zip`

### 4.1 纳入通用流程

- 先低分辨率总览，再检查关键范围的全分辨率帧。
- 能测量的内容不只靠截图猜测。
- 将测量事实与制作方式推断分开。
- 保存来源身份、画幅、帧率、时长、实际解码帧数和落定帧。
- 分区域检查哪些元素移动、哪些元素保持稳定。
- 检查元素首次出现、落定、开始退场和完全消失的时间。
- 区分平移、旋转、缩放、遮挡、擦除和整体淡入。
- 完整渲染后比较关键帧和视频时间结构。
- 不同时保留完整原片画面和重复重建的可见元素。
- 所有随机运动使用稳定种子，确保重复渲染一致。
- 先校准轮廓、尺寸、层级和锚点，再校准缓动与纹理。

### 4.2 纳入案例或组件经验

- 使用真实纹理素材并只动画显现过程。
- 把旋转锚点与元素几何中心分开记录。
- 共同运动的元素放入命名组。
- 中文和拉丁字符可以使用不同字体方案。
- 保存经过真实案例验证的 CSS/Remotion 陷阱。
- 将卡片、图钉、线条、标记圈、散入文字等实现作为特定案例组件，不上升为所有 B-roll 的规则。

### 4.3 不纳入通用流程

- 不默认调用图像生成模型制造参考素材。
- 不照搬固定画幅、坐标、帧率、时长和风格参数。
- 不为了模仿“手工感”而故意制造未经参考片证明的不一致。
- 不自动删除图片底部固定比例的区域。
- 不根据少量迹象断言参考视频一定来自 AI、AE、剪映或其他软件。
- 不将单一侦探线索板案例当作通用视觉语法。
- 外部压缩包没有明确许可证时，不直接公开再分发原脚本和组件；优先吸收思想并按本项目接口重新实现。

## 5. 目标架构

```text
ljq-broll-replica（主 Skill，工作名）
├── 参考片预检与案例初始化
├── 调用 ljq-broll-layout-structure
├── 调用 ljq-broll-motion-forensics
├── 调用 Remotion 插件和项目实现层
├── 调用 ljq-broll-fidelity-qa
├── 根据 QA 把问题退回对应阶段
└── 输出可复刻案例包
```

第一阶段只建立四个真正需要独立调用的自有 Skill：

1. `ljq-broll-replica`：总控、状态、路由、停止条件和交付。
2. `ljq-broll-layout-structure`：落定帧、元素、素材、布局和静态视觉。
3. `ljq-broll-motion-forensics`：入场、停留、出场、整体镜头运动和镜头内转场取证。
4. `ljq-broll-fidelity-qa`：静帧和视频比较，只报告问题并指定责任阶段。

Remotion 创建、交互、预览和渲染继续调用官方 Remotion 插件能力，不再新建重复的 Remotion 通用子 Skill。

转场先放在动效取证 Skill 的条件分支中。只有真实案例证明它已经形成大量独立方法和独立调用需求后，才拆成单独 Skill。

素材提取先作为布局 Skill 的条件分支。只有后续形成稳定、通用的抠图/多帧恢复流程后，才考虑独立 Skill。

## 6. 共同案例状态

不同子 Skill 不依靠聊天记忆交接，必须读取和更新同一个案例目录：

```text
workspace/cases/<case-id>/
├── case.json
├── evidence/
│   ├── source.json
│   ├── contact-sheet.png
│   └── keyframes/
├── assets/
│   ├── originals/
│   └── extracted/
├── specs/
│   ├── layout.json
│   ├── motion.json
│   └── transition.json
├── remotion/
│   ├── composition.tsx
│   └── schema.ts
└── validation/
    ├── report.json
    ├── comparison.png
    └── iterations/
```

### 6.1 真源边界

- `evidence/`：原始证据，不允许下游子 Skill 静默修改。
- `case.json`：工作状态、来源路径、阶段状态和文件索引。
- `specs/`：跨 Skill 交接的数据契约，不保存大段实现代码。
- `remotion/composition.tsx`：最终可编辑视觉实现。
- `remotion/schema.ts`：以后替换内容时允许修改的输入接口。
- `validation/`：比较证据和已知差异，不参与最终视觉输出。

### 6.2 元素稳定 ID

布局阶段创建元素 ID；动效、Remotion 和 QA 只能引用相同 ID。下游认为元素拆分错误时，应提交问题给主 Skill，不得自行建立第二套元素命名。

### 6.3 必要元素字段

```yaml
id:
type:
asset_source: original | found | extracted | recreated
completeness: complete | visible-only | unknown
bounds:
anchor:
crop_mode: viewport-clip | container-mask | asset-crop
z_index:
appearance:
confidence:
```

### 6.4 必要运动字段

```yaml
target_id:
phase: entrance | hold | emphasis | exit | camera | transition
first_visible:
settled_frame:
end_frame:
transform:
reveal:
easing_candidate:
evidence:
confidence:
```

## 7. 高保真复刻流程

### 阶段 A：参考片预检

1. 确认参考视频的绝对路径、大小、修改时间和哈希。
2. 读取画幅、帧率、时长、声明帧数和实际解码帧数。
3. 生成低分辨率 Contact Sheet，只用于理解时间阶段。
4. 划分连续镜头；不同镜头分别建立案例状态。
5. 只为关键节点提取全分辨率帧。

### 阶段 B：落定帧与静态构图

1. 选择入场完成、出场开始前的落定帧。
2. 拆解需要独立替换、定位、遮挡或运动的元素。
3. 判断素材应当寻找、提取、代码重建还是保留为完整媒体。
4. 记录位置、尺寸、锚点、裁切、层级、字体占位和静态混合效果。
5. 用 Remotion 实现默认状态等于落定帧的可编辑组件。
6. 渲染单帧并与原始落定帧叠加检查。

### 阶段 C：时间行为取证

1. 以布局阶段冻结的元素 ID 和边界为追踪区域。
2. 测量每个元素的首次出现、落定、退场和消失时间。
3. 区分整体镜头运动、父组运动和子元素内部运动。
4. 按需测量平移、缩放、旋转、透明度、模糊、遮罩、擦除和文字出现顺序。
5. 将测量和推断分别写入 `motion.json`。

### 阶段 D：Remotion 完整复刻

1. 将运动绑定到已经确认的布局组件和元素 ID。
2. 保留原始裁切、遮挡、混合模式和视觉中心。
3. 所有随机性必须使用固定种子。
4. 完整渲染目标镜头，不只渲染局部测试帧。

### 阶段 E：有限质量循环

```text
初版完整渲染
→ 本地脚本比较
→ AI 查看精简比较结果
→ 找到影响最大的一个根因
→ 退回责任阶段修正
→ 再次完整渲染
```

循环规则：

- 初版渲染不计为修正轮。
- 默认最多修正两轮。
- 第一轮优先修正结构、位置、层级、裁切、锚点和主要时间错误。
- 第二轮只处理仍明显影响观感的缓动、静态合成、字体占位和次要质感。
- 同一问题一轮后没有可测改善，先检查输入、资产、测量方法或引擎能力，不盲目微调。
- 缺少原始图层导致无法唯一反推时，选择最简单的视觉等效实现并记录已知差异。
- 比较脚本输出摘要、最差帧和比较图；不要把全部视频帧重新发送给模型。

## 8. 当前阶段验收标准

一个复刻案例只有满足以下条件，才算跑通：

- [ ] 来源、镜头范围、画幅、帧率、时长和落定帧可追溯。
- [ ] 所有主要元素具有稳定 ID。
- [ ] 落定帧 Remotion 组件可独立渲染。
- [ ] 主体位置、比例、裁切、层级和遮挡接近原片。
- [ ] 元素素材完整性和来源状态已记录。
- [ ] 入场、落定、出场和整体镜头运动具有证据或明确的推断标记。
- [ ] 字体即使不是原字体，整体文字占位和换行关系仍接近参考。
- [ ] 完整视频没有重复原片图层、意外黑帧、冻结尾帧或新增色带。
- [ ] 输出尺寸、帧率、时长和音频状态符合目标。
- [ ] 最多两次修正后生成最终版本，未陷入无效循环。
- [ ] 已知无法还原的差异已记录。
- [ ] Remotion 中的主要文字、图片、视频和主题色可替换。

本阶段不要求：

- 正式模板库索引。
- 按语义检索剪辑手法。
- 自动判断口播 B-roll 节点。
- 使用第二套内容完成正式复用测试。
- 自动在完整剪辑时间线上插入 B-roll。

## 9. 后续知识库阶段（暂缓）

复刻流程稳定后再进入以下阶段：

1. 将通过验收的案例包装为可复用模式。
2. 使用第二套差异明显的内容验证是否真正可复用。
3. 抽取 `communication_goal`、`semantic_triggers`、`avoid_when`、内容槽、推荐时长和适用画幅。
4. 相同手法在两个以上案例中验证后，再提升为公共组件或运动预设。
5. 建立案例索引和检索能力。
6. 最后开发口播切句、B-roll 机会点识别和候选手法推荐。

未来模式记录至少包含：

```yaml
communication_goal:
semantic_triggers:
avoid_when:
content_slots:
layout_component:
motion_pattern:
preferred_duration:
validated_cases:
```

## 10. 分阶段执行列表

以下任务只记录顺序；除非用户随后明确要求执行，否则保持待办状态。

### Task 1: 标记旧方案的适用状态

**Files:**

- Modify: `docs/plans/2026-09-02-ljq-broll-video-generator-design.md`
- Modify: `docs/plans/2026-09-02-broll-denoised-reference-library-prd.md`
- Modify: `README.md`

**Steps:**

1. 在两份旧计划顶部增加历史状态说明。
2. 指向本计划作为当前复刻方向。
3. 标记黑白灰结构图、低噪 reference 模式和四轮循环为已替代。
4. 不删除仍然有效的历史分析与案例记录。
5. 使用 `rg` 确认 README 不再把黑白灰 reference 模式描述为推荐新流程。

### Task 2: 冻结共同案例合同

**Files:**

- Create: `schemas/case.schema.json`
- Create: `schemas/layout.schema.json`
- Create: `schemas/motion.schema.json`
- Create: `schemas/validation.schema.json`
- Create: `docs/contracts/broll-case-contract.md`
- Create: `scripts/validate-case.mjs`
- Create: `tests/contracts/minimal-case/`

**Steps:**

1. 写出最小合法案例 fixture。
2. 写一个失败 fixture，覆盖重复元素 ID 和不存在的运动目标。
3. 编写 schema 和跨文件校验器，先验证合法/非法 fixture。
4. 固定元素 ID、裁切类型、素材完整性、证据和置信度字段。
5. 明确 JSON 是交接合同，TSX 是最终视觉实现。
6. 提交前运行所有 schema fixture。

### Task 3: 创建主 Skill 骨架

**Files:**

- Create: `skills/ljq-broll-replica/SKILL.md`
- Create: `skills/ljq-broll-replica/agents/openai.yaml`
- Create: `skills/ljq-broll-replica/references/routing.md`
- Create: `skills/ljq-broll-replica/references/case-state.md`

**Steps:**

1. 只写目标、阶段、子 Skill 路由、质量门和停止条件。
2. 禁止在主 `SKILL.md` 复制每个子 Skill 的详细工作流。
3. 指定任何继续任务必须先读取现有 `case.json`。
4. 指定缺少上一阶段产物时不得假装继续。
5. 运行官方 `quick_validate.py`。

### Task 4: 迁移并增强落定帧布局子 Skill

**Files:**

- Create or Sync: `skills/ljq-broll-layout-structure/`
- Create: `skills/ljq-broll-layout-structure/references/asset-recovery.md`
- Create: `skills/ljq-broll-layout-structure/references/static-compositing.md`
- Create: `tests/cases/settled-layout-basic/`

**Steps:**

1. 将当前已安装 Skill 同步到项目源目录，项目目录成为维护真源。
2. 保留“一个镜头一个落定帧”的规则。
3. 增加素材完整性和三类裁切记录。
4. 增加字体近似匹配的验收方式。
5. 增加静态混合模式、透明度、模糊、阴影和辉光的候选记录。
6. 删除任何新建黑白灰结构图的路径。
7. 用一个真实落定帧完成 Remotion still 对照测试。

### Task 5: 创建参考片预检脚本

**Files:**

- Create: `skills/ljq-broll-replica/scripts/inspect-clip.py`
- Create: `tests/scripts/test-inspect-clip.py`
- Create: `tests/fixtures/short-reference.mp4`

**Steps:**

1. 先写来源信息、帧数和 Contact Sheet 的测试。
2. 实现来源哈希、元信息和低分辨率抽样。
3. 只为指定关键帧导出全分辨率图片，不默认导出全部 PNG。
4. 输出紧凑 `source.json`，不向模型打印逐帧长日志。
5. 在短视频 fixture 上验证可重复输出。

### Task 6: 创建动效取证子 Skill

**Files:**

- Create: `skills/ljq-broll-motion-forensics/SKILL.md`
- Create: `skills/ljq-broll-motion-forensics/agents/openai.yaml`
- Create: `skills/ljq-broll-motion-forensics/references/measurement-guide.md`
- Create: `skills/ljq-broll-motion-forensics/scripts/track-elements.py`
- Create: `skills/ljq-broll-motion-forensics/scripts/trace-reveal.py`
- Create: `tests/motion-forensics/`

**Steps:**

1. 先建立平移、旋转、遮挡、擦除和淡入的合成测试片段。
2. 让脚本使用布局阶段的元素边界和稳定 ID。
3. 为低纹理、遮挡和大幅缩放输出“不可信”，而不是伪精确数字。
4. 将测量结果和推断结果分开写入 `motion.json`。
5. 不纳入“判断视频来自哪种软件”的功能。
6. 验证同一输入重复运行得到一致结果。

### Task 7: 调整 Remotion 实现层

**Files:**

- Modify: `skills/ljq-broll-video-generator/assets/remotion-renderer/src/`
- Modify: `skills/ljq-broll-video-generator/assets/remotion-renderer/package.json`
- Create: `tests/remotion/`

**Steps:**

1. 添加稳定元素 ID 与案例合同的映射测试。
2. 保留真实可编辑元素，不再以黑白灰 reference 画面作为新主流程。
3. 支持分组、锚点、画布越界、容器遮罩和静态混合效果。
4. 将随机动画改为固定种子。
5. 保证所有 `remotion` 与 `@remotion/*` 版本完全一致。
6. 类型检查后渲染最小测试构图。

### Task 8: 创建保真 QA 子 Skill 与比较脚本

**Files:**

- Create: `skills/ljq-broll-fidelity-qa/SKILL.md`
- Create: `skills/ljq-broll-fidelity-qa/agents/openai.yaml`
- Create: `skills/ljq-broll-fidelity-qa/scripts/compare-frame.py`
- Create: `skills/ljq-broll-fidelity-qa/scripts/compare-video.py`
- Create: `tests/fidelity-qa/`

**Steps:**

1. 为尺寸错误、帧数错误、时间偏移和局部位置偏移建立测试。
2. 输出并排图、半透明叠加图、差异图、最差帧和紧凑报告。
3. 将像素差异作为回归信号，不设置脱离案例的万能阈值。
4. 根据问题类型输出责任阶段和元素 ID。
5. QA 只报告和归因，不静默修改布局或运动。
6. 验证比较脚本不会把临时参考层带入最终视频。

### Task 9: 实现最多两轮的主控循环

**Files:**

- Modify: `skills/ljq-broll-replica/SKILL.md`
- Modify: `skills/ljq-broll-replica/references/routing.md`
- Create: `skills/ljq-broll-replica/references/quality-loop.md`
- Create: `tests/workflows/replica-loop/`

**Steps:**

1. 建立初版、修正一、修正二三个版本状态。
2. 每轮只允许处理一个最高影响根因或一组同根因问题。
3. 根据 QA 的责任阶段定向退回，不重跑全部子 Skill。
4. 达到硬性质量门时提前停止。
5. 两轮后仍不通过时保存已知差异和阻塞原因。
6. 验证不会出现无限递归或重复渲染。

### Task 10: 用真实案例验收复刻流程

**Files:**

- Create: `workspace/cases/<case-id>/`
- Create: `docs/qa/<date>-<case-id>-replica.md`

**Steps:**

1. 先选择一个连续、短、元素数量适中的真实 B-roll。
2. 完整运行预检、布局、动效、Remotion 和 QA。
3. 完成最多两次有目标的修正。
4. 检查中断后能否仅靠案例目录继续任务。
5. 记录效果差异、Token 使用方式、计算时间和人工介入点。
6. 第一个案例稳定后，再选择不同类型的第二个案例。
7. 至少两个不同类型案例通过后，才宣布复刻流程稳定。

### Task 11: 暂缓的知识库与口播应用

**Files:**

- Future Create: `broll-library/`
- Future Create: `skills/ljq-broll-script-planner/`
- Future Create: `docs/plans/<date>-broll-knowledge-library-prd.md`

**Entry Criteria:**

- 至少两个不同类型真实复刻案例通过当前流程。
- 主 Skill 能在新任务中读取案例状态并继续。
- 布局、动效和 QA 问题能够稳定归因。
- 复刻结果具有可替换的 Remotion props/schema。

未满足以上条件前，不开始知识库索引、语义检索或口播自动选点开发。

## 11. 完成定义

当前复刻阶段完成的标志不是“写完全部 Skill”，而是：

1. 用户只需要调用一个主 Skill。
2. 主 Skill 能稳定串联布局、动效、Remotion 和 QA。
3. 子 Skill 通过共同案例状态交接，不依赖聊天记忆。
4. 至少两个不同类型参考片完成高保真复刻。
5. 每个案例最多经过两次定向修正。
6. 中断或切换任务后能够通过案例目录恢复。
7. 输出是可编辑、可替换的 Remotion 组件，而不是压平参考图。
8. 案例结构已经为未来知识库保留接口，但当前没有过早建设知识库。

达到以上条件后，再为知识库与口播应用单独编写下一阶段 PRD。
