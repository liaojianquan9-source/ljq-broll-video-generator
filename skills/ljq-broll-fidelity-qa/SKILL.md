---
name: ljq-broll-fidelity-qa
description: "对 B-roll 案例的范围、完整 Remotion 渲染、逐场景静帧、可替换元素、连续动线和逐帧视觉差异做保真验收，输出带证据的 validation/report.json 并归因到唯一责任阶段。用于决定通过或定向修正；不直接跨阶段改源码。"
metadata:
  version: "1.2.1"
---

# B-roll 保真 QA

QA 负责生成比较证据、做视觉判断和归因。像素指标用于定位差异，不能单独宣布高保真通过。

## 开始条件

1. 读取 `case.json`、layout、motion、完整 render 和 [references/quality-gate.md](references/quality-gate.md)；`implementation` 必须为 `passed`。
2. 新版案例必须已有逐场景 still、替换 still、motion continuity 和范围合同。
3. 使用主 Skill `.venv/bin/python` 运行本 Skill 脚本。

## 工作流

1. **生成待审证据。**

   ```bash
   /path/to/ljq-broll-replica/.venv/bin/python /path/to/ljq-broll-fidelity-qa/scripts/qa-case.py <case-dir>
   ```

   检查原片、渲染视频、comparison 图、最差帧和逐帧指标。
2. **核对 live 元素。** 检查运行时可见层与代码。文字、数字、参数、线条、框和遮罩必须可编辑；参考帧、Contact Sheet、视频裁片或 alpha 文字贴图泄漏到成片时直接失败。
3. **核对排除区域。** 有 `scope.exclude` 时，按 `excludedRegionMode` 验证空白/透明/底色，并确认 `exclusionMask` 只排除用户明确不要的区域。
4. **记录人工门。** 把上述证据保存在案例目录后运行：

   ```bash
   node /path/to/ljq-broll-replica/scripts/record-qa-gates.mjs <case-dir> \
     --live-status pass --live-evidence <path> --live-observation "可见元素为 live 实现" \
     --excluded-status pass --excluded-evidence <path> --excluded-observation "排除区域符合范围合同"
   ```

   无排除项时 `--excluded-status not_applicable`，仍需提供证明“范围合同无排除项”的案例内证据。
5. **判断完整动态结果。** 逐元素核对首次出现、落定、退出、方向、缩放对象、擦开前沿、叠影收束和整体镜头尾巴；完整播放检查闪帧、尾帧、遮罩、字体与媒体错误。
6. **写入视觉结论。** 通过时运行：

   ```bash
   /path/to/ljq-broll-replica/.venv/bin/python /path/to/ljq-broll-fidelity-qa/scripts/qa-case.py <case-dir> --visual-status pass --observation "完整观看后范围、静帧、替换、动线与全片通过"
   ```

   明显偏差使用 `--visual-status fail --owner preflight|layout|motion|implementation|qa --observation "..."`，每次只指定一个最高影响根因或同根因问题组。

## 归因

| 现象 | owner |
| --- | --- |
| 来源、范围、镜头、帧数错 | `preflight` |
| 元素、素材、几何、裁切、层级、字体、静态材质错 | `layout` |
| 时间、方向、缩放对象、缓动、转场、动线连续性错 | `motion` |
| 规格正确但浏览器渲染、字体加载、遮罩、媒体或编码错 | `implementation` |
| 帧未对齐、遮罩误排除或报告错 | `qa` |

QA 不修源码，不增加修正计数。主 Skill 按质量循环开始定向修正。

## 完成标准

`validation/report.json` 包含 dimensions、fps、frame-count、audio、scope、live-elements、replacement-smoke、settled-scenes、motion-continuity、excluded-regions 和 visual-fidelity。除合同允许 `not_applicable` 的检查外，全部必须为 `pass`；证据路径必须存在。
