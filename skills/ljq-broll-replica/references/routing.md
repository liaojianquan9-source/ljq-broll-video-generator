# 主 Skill 路由与责任边界

## 总则

主 Skill 在整个复刻任务中保持控制。子 Skill 只读取完成本阶段所需的证据和规格，并把结果写回共同案例目录。不要为每个阶段创建互不相干的新任务，也不要使用长篇自然语言摘要代替规格文件。

## 阶段路由

| 阶段 | 前置条件 | 负责内容 | 必须输出 | 不得修改 |
| --- | --- | --- | --- | --- |
| `preflight` | 原始参考视频 | 来源身份、视频元信息、连续镜头范围、Contact Sheet、关键帧 | `case.json`、`evidence/source.json` | 原视频 |
| `layout` | 预检通过、落定帧可见 | 元素 ID、素材状态、最终边界、锚点、裁切、层级、静态外观 | `specs/layout.json`、`remotion/composition.tsx`、`remotion/schema.ts` | 来源身份、镜头范围 |
| `motion` | 布局通过、元素 ID 冻结 | 入场、停留、强调、出场、整体镜头和转场证据 | `specs/motion.json` | 已确认元素 ID 和最终布局 |
| `implementation` | 布局与动效规格有效 | 可编辑 Remotion 组件、props/schema、完整渲染 | TSX、schema、MP4 | 测量事实 |
| `qa` | 完整渲染存在 | 单帧、关键帧、时长、帧数、音频和视觉比较 | `validation/report.json`、比较图 | 布局、动效和实现源码 |

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

QA 每次只选择一个最高影响根因，或一组共享同一根因的问题。主 Skill 通过 `begin-correction.mjs` 增加 `correctionsUsed` 后退回责任阶段；除受该根因影响的实现与 QA 外，其他已通过阶段保持冻结。

## 两轮循环

```text
初版完整渲染
→ QA 0
→ 修正 1：优先结构、层级、锚点和主要时间
→ QA 1
→ 修正 2：只处理仍明显影响观感的问题
→ QA 2
→ 通过，或带已知差异停止
```

像素指标只用于定位回归，不使用跨案例的万能阈值。独立重建只需达到视觉等效，不要求重建原作者的软件、插件或不可见图层。

## Remotion 路由

- 创建或适配组合：加载 `remotion:remotion-create` 与 `remotion:remotion-markup`。
- 需要元素在 Studio 中选择和调整：加载 `remotion:remotion-interactivity`。
- 检查预览：加载 `remotion:remotion-studio`。
- 导出 still 或视频：加载 `remotion:remotion-render`。
- 裁切、媒体元信息或帧操作：按需加载 `remotion:remotion-multimedia`。

主 Skill 只保存本项目特有的复刻决策，不复制 Remotion 官方通用最佳实践。
