# 新版复刻流程执行状态

更新日期：2026-09-03

## 已能直接执行

| 能力 | 入口 | 输出 |
| --- | --- | --- |
| 安装环境 | `skills/ljq-broll-replica/scripts/setup-environment.sh` | 锁定版本的 Python、Schema 校验和 Remotion 依赖 |
| 初始化案例与预检 | `inspect-clip.py <video> <case-dir>` | 案例内原片、哈希、元信息、关键帧、Contact Sheet、`case.json` |
| 合同校验 | `validate-case.mjs <case-dir> [--complete]` | Schema、文件、哈希、稳定 ID、时间线和阶段错误 |
| 动效测量 | motion Skill 的 `motion_track.py`、`element_timeline.py`、`edge_trace.py` | 平移/旋转、出现时序、文字顺序和线条揭示证据 |
| Remotion 案例初始化 | `initialize-case-remotion.mjs <case-dir>` | 可编辑 composition、runtime、props schema 与静态 motion 占位 |
| 完整渲染 | `render-case.sh <case-dir>` | 与源画幅/fps/帧数一致的 MP4，并更新实现状态 |
| 完整视频 QA | QA Skill 的 `qa-case.py <case-dir>` | 全帧指标、原片/渲染/差异比较图、`validation/report.json` |
| 有限修正 | `begin-correction.mjs` | 保存轮次证据、定向退回责任阶段、严格限制最多两轮 |
| 本机安装 | `scripts/install-local-skills.sh` | 安装主 Skill 与三个子 Skill，并备份旧版本 |

这些工具已用合成视频走通过合同、实际 Remotion 渲染、逐帧 QA、最终 `--complete` 校验和第三轮拒绝测试。

## 能执行，但需要 AI 视觉判断

以下不是“不能运行”，而是不能靠通用脚本可靠地自动决定：

- 从候选帧中选择真正的落定帧；
- 决定哪些内容应拆成独立元素或父组；
- 校准位置、尺寸、裁切、层级、字体占位和混合模式；
- 判断某段变化是主体运动、镜头运动、遮罩还是转场；
- 观看比较证据后决定视觉通过，或把最大根因归给 layout、motion、implementation；
- 复杂背景下的元素抠取与 visible-only 完整性判断。

因此 QA 默认只写 `pending`，不会仅凭像素分数自动宣布高保真通过。

## 当前尚未建设

- 多案例知识库、剪辑手法索引和相似案例检索；
- 根据新口播自动判断 B-roll 插入节点；
- 用新内容自动调用案例并完成正式复用测试；
- 对任意复杂视频的一键自动分镜、精确抠图和隐藏区域恢复；
- 从压平视频精确反推原字体、原插件、AE/剪映工程参数；
- 两个不同类型真实案例的新版流程验收。

前五项是明确延后的下一阶段；最后一项需要用户提供新的真实切口后才能验收。仓库现有两个案例是研究基线，不冒充新版流程通过结果。
