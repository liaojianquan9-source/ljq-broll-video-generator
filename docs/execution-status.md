# 新版复刻流程执行状态

更新日期：2026-09-05

## 已能直接执行

| 能力 | 入口 | 输出 |
| --- | --- | --- |
| 安装环境 | `skills/ljq-broll-replica/scripts/setup-environment.sh` | 锁定版本的 Python、Schema 校验和 Remotion 依赖 |
| 初始化案例与预检 | `inspect-clip.py <video> <case-dir> --start-seconds ... --end-seconds ...` | 按范围精确裁切的案例内源片、纳入/排除合同、哈希、元信息、关键帧和 Contact Sheet |
| 合同校验 | `validate-case.mjs <case-dir> [--complete]` | Schema、范围、文件、哈希、场景 still、替换 still、稳定 ID、连续性和 QA gates |
| 逐场景静帧 | layout Skill 的 `render-layout-scene.sh` | 原片/Remotion/比较 still 与场景状态 |
| 替换冒烟 | layout Skill 的 `render-replacement-still.sh` | 替换 props 后的 still 与元素测试状态 |
| 安全回归探针 | `render-review-stills.mjs <case-dir> --mode static --dry-run`后实际导出 | 新目录、真实props、批量still与待审manifest；不覆盖批准基准或写QA状态 |
| 动效测量 | motion Skill 的 `motion_track.py`、`element_timeline.py`、`edge_trace.py` | 平移/旋转、出现时序、文字顺序和线条揭示证据 |
| 连续性分析 | `analyze-motion-continuity.mjs <case-dir>` | 空间曲线的重复帧、反向、近停与速度尖峰证据 |
| Remotion 案例初始化 | `initialize-case-remotion.mjs <case-dir>` | 可编辑 composition、runtime、props schema 与静态 motion 占位 |
| 完整渲染 | `render-case.sh <case-dir>` | 与源画幅/fps/帧数一致的 MP4，并更新实现状态 |
| 完整视频 QA | `record-qa-gates.mjs` + QA Skill 的 `qa-case.py` | live 元素、排除区域、全帧指标、原片/渲染/差异比较图和必需检查报告 |
| 有限修正 | `begin-correction.mjs` | 保存轮次证据、定向退回责任阶段、严格限制最多两轮 |
| 本机安装 | `scripts/install-local-skills.sh` | 安装主 Skill 与三个子 Skill，并备份旧版本 |

这些工具已用合成视频走通精确裁切、合同校验、静帧/替换 still、连续曲线、斜向擦开、叠影文字、完整 Remotion 渲染、逐帧 QA、最终 `--complete` 校验和第三轮拒绝测试。

## 能执行，但需要 AI 视觉判断

以下不是“不能运行”，而是不能靠通用脚本可靠地自动决定：

- 从候选帧中选择真正的落定帧；
- 决定哪些内容应拆成独立元素或父组；
- 校准位置、尺寸、裁切、层级、字体占位和混合模式；
- 判断某段变化是主体运动、镜头运动、遮罩还是转场；
- 观看比较证据后决定视觉通过，或把最大根因归给 layout、motion、implementation；
- 复杂背景下的元素抠取与 visible-only 完整性判断。

因此 QA 默认保持待审，不会仅凭像素分数自动宣布高保真通过；人工观看、所有必需门和最终validator均满足时才可声明全流程通过。

## 新增真实案例与限制

[KIMI 0–11秒案例](../examples/kimi-k3-000-011/README.md)使用GPT-6 Astra + Remotion，四场景、42元素、26条motion，静态与动态整体效果已获用户认可。保留本机完整case，公开展示包提供成片、上下对照与实际源码；不是包含全部取证文件的完整合同归档。

当前比较器只支持单张静态排除mask，本案例排除区域会随场景和穿字转场变化。因此自动QA仍待审，不能用宽泛或占位mask绕过，也不因用户认可而改成passed。另有字体与纹理近似、长文案局部重叠等已知差异。

安全still工具要求composition声明并实际消费`motionEnabled`，通用模板尚未默认提供该入口；无此能力时先补静态入口。工具默认寻找macOS Chrome，其他系统需指定浏览器路径。较低成本模型尚未做同条件视觉制作测试。

## 当前尚未建设

- 多案例知识库、剪辑手法索引和相似案例检索；
- 根据新口播自动判断 B-roll 插入节点；
- 用新内容自动调用案例并完成正式复用测试；
- 对任意复杂视频的一键自动分镜、精确抠图和隐藏区域恢复；
- 从压平视频精确反推原字体、原插件、AE/剪映工程参数；
- 两个不同类型真实案例的新版流程验收。

前五项是明确延后的下一阶段；最后一项仍未达到。新KIMI案例的人工认可不冒充两个不同类型案例的完整自动验收，两个旧案例继续保留为研究基线。
