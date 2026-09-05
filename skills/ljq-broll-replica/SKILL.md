---
name: ljq-broll-replica
description: "把用户指定的连续 B-roll 参考片复刻成可编辑、可替换的 Remotion 案例，并完成范围预检、逐场景静帧、逐元素动效、完整渲染和有限 QA 修正。用于直接临摹或高保真复刻；不负责从口播自动选点或推荐模板。"
metadata:
  version: "1.4.0"
---

# B-roll 高保真复刻总控

同一个案例目录贯穿预检、布局、动效、实现和 QA。参考视频提供视觉与时间证据；交付物是分层组件、机器合同、完整渲染和比较证据。

## 路由

- **执行手册**：新建、恢复案例或选择取证/渲染工具前，必须阅读 [references/execution-playbook.md](references/execution-playbook.md)，确认本轮停止阶段、工具副作用、批准静帧保护和能力缺失分支。
- **范围合同**：原视频需要按时码截取、用户纠正过范围或内容有纳入/排除要求时，阅读 [references/scope-lock.md](references/scope-lock.md)。完成标准是 `case.json.schemaVersion=1.2`、案例内源片时长与请求相差不超过一帧。
- **恢复合同**：案例目录已存在或任务从中断处恢复时，阅读 [references/case-state.md](references/case-state.md)，先运行 `node $SKILL_DIR/scripts/validate-case.mjs <case-dir>`。续做全流程从首个未通过阶段继续；回归、审阅或文档维护按本轮请求进入对应分支。
- **阶段合同**：开始制作前阅读 [references/routing.md](references/routing.md)，保持阶段 owner 和稳定元素 ID。
- **复用门**：进入布局或 QA 时阅读 [references/reusability-gates.md](references/reusability-gates.md)。可替换元素、逐场景静帧和字体证据必须能被合同与校验器找到。
- **视觉判断**：测量静帧、校准配色/材质、分析蒙版或审阅替换结果前，必须阅读布局 owner 的 [static-compositing.md](../ljq-broll-layout-structure/references/static-compositing.md)；总控与 QA 共用这一套判断规则。
- **两轮门**：初版 QA 失败后阅读 [references/quality-loop.md](references/quality-loop.md)，只通过状态脚本开始修正。
- **复盘与迁移**：用户要求总结测试、更新判断规则或验证其他模型能否沿用时，阅读 [references/case-kimi-k3.md](references/case-kimi-k3.md)；它是有局限的行为样例，不是新案例参数模板。

把当前 Skill 目录记为 `SKILL_DIR`。先检查现有依赖；缺失或确需更新时才运行 `$SKILL_DIR/scripts/setup-environment.sh`，它会安装依赖。写 Remotion 代码时加载 `remotion:remotion-best-practices`、`remotion:remotion-markup` 和 `remotion:remotion-interactivity`；预览和导出时加载对应的 Studio/Render 能力。

## 执行

1. **锁定范围。** 将用户表达标准化为起止秒数、纳入项、排除项和排除区域模式；有实质歧义时只问一个定向问题。运行 `inspect-clip.py` 的范围参数建立案例。`preflight` 只在裁切帧数、来源哈希、画幅、fps 和音频均有效后完成。
2. **通过静帧门。** 使用 `$ljq-broll-layout-structure`。每个 `sceneId` 都必须生成 source/render/comparison still 并标为 `passed`；每个 `replaceable: true` 元素都必须有通过的替换 still。`layout` 合同通过校验后才能继续；用户要求先确认静帧时在此交付等待，不开始动效。
3. **通过连续性门。** 使用 `$ljq-broll-motion-forensics`。场景、镜头、元素和文字行为分别成轨；运行 `analyze-motion-continuity.mjs`，只有 `motion.continuity.status=passed` 才完成动效阶段。
4. **完整实现与渲染。** 运行 `$SKILL_DIR/scripts/render-case.sh <case-dir>`。完整 MP4 的画幅、fps、帧数和音频合同必须与案例内源片一致。
5. **通过 QA。** 视觉检查后用 `record-qa-gates.mjs` 记录 live 元素和排除区域证据，再使用 `$ljq-broll-fidelity-qa` 生成报告。新版案例的全部必需 check 存在且通过时，QA 才能写入 `passed`。
6. **定向修正。** QA 失败时按两轮门返回唯一 owner 阶段。两轮后仍存在差异则记录已知差异并停止。
7. **交付。** 全流程完成时运行 `node $SKILL_DIR/scripts/validate-case.mjs <case-dir> --complete`。完成标准是案例、规格、源码、渲染、QA 门和比较证据全部可恢复且校验通过。阶段性交付或工具门待审时使用普通校验，保留真实状态并说明已完成产物与未过项，不宣称全流程通过。

## 硬边界

- 一个案例承载用户指定的一个连续时间范围；范围内的镜头/排版变化拆为scene，转场允许有证据的交叠。只有用户指定分案例或给出不连续范围时才另建案例，不因切点擅自改变交付粒度。
- 复刻用户指定的可见剪辑元素；人物或 A-roll 的纳入方式服从范围合同。
- 测量、观察、推断和默认值分别标记；不可唯一恢复的信息保留置信度和已知差异。
- 缺少会改变用户意图的关键素材时请求素材；现有素材与案例文件保持不变。

## 交付内容

`case.json`、来源证据、layout/motion 合同、可编辑 Remotion 源码、完整 MP4、QA gates、比较证据和最多两轮的修正记录。
