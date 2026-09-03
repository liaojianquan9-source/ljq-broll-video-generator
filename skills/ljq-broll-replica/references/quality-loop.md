# 最多两轮的质量循环

初版完整渲染是 pass 0，不计修正。QA 先生成比较证据，再由 AI 观看原片、渲染和比较图，选择一个最高影响根因并指定 owner。

## 状态机

```text
render pass 0 → QA
  ├─ pass → complete validation → stop
  └─ fail → begin-correction 1 → owner stage → render → QA
       ├─ pass → stop
       └─ fail → begin-correction 2 → owner stage → render → QA
            ├─ pass → stop
            └─ fail → known difference / blocked → stop
```

使用 `begin-correction.mjs`，不要手改计数。脚本保存上一轮报告、递增 `correctionsUsed`、使旧 render/validation 失效，并在第 3 次尝试时拒绝继续。

## 修正规则

- 第一轮优先结构、素材、裁切、层级、锚点和主要时间。
- 第二轮只修仍明显影响观感的问题。
- 同一根因造成多个元素偏差可以一起修；不同根因不要混成一轮。
- 指标未改善时先质疑来源、素材、测量和实现能力，不继续盲调数值。
- 达到质量门立即停止，不必耗完两轮。
- 缺少证据或原始图层时记录已知差异，不能通过增加循环次数换取虚假确定性。
