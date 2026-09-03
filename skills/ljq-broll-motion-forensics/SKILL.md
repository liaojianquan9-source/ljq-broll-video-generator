---
name: ljq-broll-motion-forensics
description: "对已完成落定布局的连续 B-roll 镜头做动效取证，把入场、停留、强调、出场、整体镜头与转场绑定到稳定元素 ID，输出可验证的 motion.json。适用于区分平移与旋转、测量首次出现和落定帧、判断擦除与淡入、识别文字出现顺序；不重新拆布局，也不猜原作者使用的软件或插件。"
---

# B-roll 动效取证

围绕已经确认的静态终点测量“元素怎样到达和离开”。优先运行脚本取得轨迹和时间证据，再用观察或克制推断补足无法从压平视频唯一恢复的部分。

## 开始前

1. 读取案例 `case.json`、`evidence/source.json` 和 `specs/layout.json`；`preflight`、`layout` 必须通过。
2. 阅读 [references/measurement-guide.md](references/measurement-guide.md)。
3. 使用主 Skill 的 `.venv/bin/python` 运行本 Skill 脚本；依赖由主 Skill `scripts/setup-environment.sh` 安装。
4. 读取主 Skill 的 `schemas/motion.schema.json`。所有 `targetId` 必须来自 layout，或使用 `@camera`、`@scene`、`@transition`。

## 流程

1. 按需运行 `scripts/extract-analysis-frames.sh <case-dir>` 解码全分辨率分析帧。细线和小字不能只看缩略图。
2. 对有纹理且未被遮挡的区域运行 `motion_track.py`，区分平移、共同运动和绕轴旋转。
3. 用 `element_timeline.py` 测量元素首次出现、落定和文字单元出现顺序。
4. 用 `edge_trace.py` 沿线采样强度，区分擦除边界移动与整条线同时淡入。端点有圆点时必须排除端点。
5. 同时观察落定后的微漂移、整体镜头缩放、遮罩、模糊、色相/亮度变化和出场。不能测量时记录 `observed` 或 `inferred`。
6. 把证据转成 `specs/motion.json`：像素位移、无单位缩放、角度旋转、0..1 透明度/揭示进度、像素模糊；所有帧号为整数且在时间线内。
7. 更新 `case.json.files.motion` 与 `stages.motion=passed`，运行主 Skill 校验器。

## 约束

- 布局元素 ID 已冻结。拆分错了就把问题交回 layout，不在本阶段创造平行元素。
- 落定帧的运动值应回到布局默认状态；整体镜头运动绑定 `@camera`，不要重复写进每个子元素。
- 低纹理区域、遮挡时段和压缩噪声会制造假位移。至少用另一区域或相邻帧交叉验证。
- 一个视觉结果可能来自多种工具。只报告可见运动与可复现参数，不声称识别出 AE 插件或原工程设置。
- 随机文字散射必须写固定 `seed`。Remotion 的逐帧输出必须确定性。
- 不在这里修改静态 bounds、素材、层级或字体占位。

## 输出

必须生成 `specs/motion.json`，每条 motion 含稳定 ID、目标、阶段、首次出现/落定/结束帧、至少一种轨迹或揭示/文字行为、证据和置信度。分析日志可保存在 `evidence/motion/`，但 JSON 合同不能只引用聊天结论。
