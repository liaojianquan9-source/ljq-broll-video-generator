# LJQ B-roll Video Generator v0.1 质检记录

- 日期：2026-09-02
- 被测 Skill：`skills/ljq-broll-video-generator`
- 结论：第一稿最小闭环通过

## 验证范围

1. Skill 目录和 YAML frontmatter。
2. Scene JSON 静态校验。
3. Remotion TypeScript 类型检查。
4. 低噪 `reference` 模式实际渲染。
5. 真实文字 `final` 模式实际渲染。
6. 本地绝对图片路径暂存和渲染。
7. MP4 元信息、关键帧和 Contact Sheet 生成。
8. 参考视频准备脚本。

## Loop 记录

### Loop 1：低噪参考渲染

- 输入：`assets/examples/evidence-board-reference.json`
- 结果：Remotion 成功生成 120 帧 MP4。
- 发现问题：渲染后的质检抽帧阶段在 macOS `awk` 的三元表达式处失败。
- 修改：将结束时间计算改成显式赋值和 `if` 判断。
- 结论：进入下一轮。

### Loop 2：低噪参考重渲染

- 结果：视频、`ffprobe.json`、开始/中间/结束帧和 Contact Sheet 全部生成。
- 视觉检查：卡片按顺序进入，关系线后出现，重点文字最后出现；图层和画面边界无明显错误。
- 结论：通过。

### Loop 3：最终成片模式

- 输入：`assets/examples/title-final.json`
- 结果：成功生成 90 帧 MP4 和完整质检包。
- 视觉检查：小标题、主标题、辅助文字和强调线按顺序出现，文字可读，无裁切和拉伸。
- 结论：通过。

### Loop 4：本地图片路径

- 输入：`workspace/drafts/media-staging-smoke.json`
- 结果：绝对路径图片被复制到 Remotion 暂存目录，成功生成 45 帧 MP4。
- 结论：通过。

### 环境脚本复查

- 第一次运行：依赖安装和类型检查通过，但打印 Remotion 版本时引号不兼容。
- 修改：版本读取改为独立 Node 参数。
- 第二次运行：所有环境项正确显示，退出码为 0。
- 结论：通过。

## 自动检查结果

| 检查 | 结果 |
|---|---|
| `quick_validate.py` | 通过 |
| `validate-scene.mjs` reference 示例 | 通过 |
| `validate-scene.mjs` final 示例 | 通过 |
| `tsc --noEmit` | 通过 |
| 低噪视频分辨率 | 1280×720，通过 |
| 低噪视频帧率 | 30 fps，通过 |
| 低噪视频帧数 | 120，通过 |
| 最终视频分辨率 | 1280×720，通过 |
| 最终视频帧率 | 30 fps，通过 |
| 最终视频帧数 | 90，通过 |
| 本地图片暂存与渲染 | 通过 |
| 参考视频抽帧与 Contact Sheet | 通过 |

## 第一稿已具备

- 一个 Scene JSON 同时表达布局和运动。
- 黑白灰低噪参考与真实内容两种模式。
- Shape、Text、Image、Video 和 Line 五类元素。
- 位置、缩放、旋转、透明度、模糊、揭示和周期摆动。
- 本地图片和视频素材自动暂存。
- JSON 校验、实际渲染和质检包生成。
- 最多四轮、同一问题三次无改善即停止的循环规则。

## 已知边界

- 参考图的语义元素和坐标由当前 AI 视觉判断写入 JSON，不是 Remotion 自动识图。
- 参考视频第一稿提供抽帧和 Contact Sheet；精确位移、旋转和颜色时间线测量将在下一阶段加入。
- 第一稿只支持直线，不支持自由曲线或复杂路径。
- `groupId` 已保留，但当前渲染器还没有组级统一变换。
- 不包含台词分析、B-roll 插入点判断和自动模板推荐。
- 复杂三维、粒子、骨骼和摄像机运动不在第一稿范围。

## 抽查入口

- 低噪参考：`workspace/outputs/skill-smoke/evidence-board-reference.mp4`
- 低噪质检包：`workspace/outputs/skill-smoke/evidence-board-reference.qa/`
- 最终文字样例：`workspace/outputs/skill-smoke/title-final.mp4`
- 最终样例质检包：`workspace/outputs/skill-smoke/title-final.qa/`
- 本地图片测试：`workspace/outputs/skill-smoke/media-staging-smoke.mp4`
