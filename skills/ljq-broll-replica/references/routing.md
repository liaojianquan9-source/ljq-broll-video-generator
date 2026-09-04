# 主 Skill 路由与责任边界

## 总则

主 Skill 在整个复刻任务中保持控制。子 Skill 只读取完成本阶段所需的证据和规格，并把结果写回共同案例目录。不要为每个阶段创建互不相干的新任务，也不要使用长篇自然语言摘要代替规格文件。

## 阶段路由

| 阶段 | 前置条件 | 负责内容 | 必须输出 | 不得修改 |
| --- | --- | --- | --- | --- |
| `preflight` | 原始参考视频与用户范围 | 来源身份、精确时码、纳入/排除项、案例内副本、视频元信息和关键帧 | `case.json`、`evidence/source.json` | 原视频 |
| `layout` | 预检通过、落定帧可见 | 逐场景落定帧、元素 ID、素材、几何、裁切、层级、字体和静态外观 | layout、Remotion 源码、逐场景 still、替换 still | 来源身份、范围 |
| `motion` | 布局通过、元素 ID 冻结 | 入场、停留、强调、出场、整体镜头、转场和连续性证据 | `specs/motion.json`、`evidence/motion/continuity.json` | 已确认元素 ID 和最终布局 |
| `implementation` | 布局与动效规格有效 | 可编辑 Remotion 组件、props/schema、完整渲染 | TSX、schema、MP4 | 测量事实 |
| `qa` | 完整渲染存在 | 范围、live 元素、排除区域、静帧、替换、连续性、媒体硬门和全片视觉比较 | `validation/gates.json`、`validation/report.json`、比较图 | 布局、动效和实现源码 |

## 前置产物检查

- `layout` 不得在没有可信落定帧时开始。
- `motion` 不得在布局元素 ID 未冻结时开始。
- `implementation` 不得用自己的临时元素名绕过无效规格。
- `qa` 不得只检查 still 后宣称完整视频通过。
- 恢复已有案例时先校验 `case.json` 和索引文件；校验失败时返回拥有该字段的阶段。

## 问题归因

| 现象 | 责任阶段 |
| --- | --- |
| 来源、帧数、镜头边界错误 | `preflight` |
| 元素缺失、重复、位置、尺寸、锚点、裁切或层级错误 | `layout` |
| 首次出现、落定、退出、运动方向、缩放对象或缓动错误 | `motion` |
| 规格正确但浏览器渲染、字体加载、遮罩或编码错误 | `implementation` |
| 比较结果错误、帧未对齐或报告不完整 | `qa` |

QA 每次只选择一个最高影响根因，或一组共享同一根因的问题。修正次数、回退方法和停止条件只以 [quality-loop.md](quality-loop.md) 为准。Remotion 通用用法由对应的 Remotion Skill 提供，本文不复制。
