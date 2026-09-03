# B-roll 复刻案例交接合同

## 目的

主 Skill 与子 Skill 通过同一个案例目录交接，不依赖聊天记忆或“右边那张图”一类模糊描述。任何阶段恢复、换任务或重新加载 Skill 时，都先读取 `case.json` 及自己负责的规格文件。

## 文件职责

| 文件 | 责任 | 是否允许下游静默修改 |
| --- | --- | --- |
| `case.json` | 来源、阶段、文件索引和修正次数 | 否；只更新自己拥有的状态字段 |
| `evidence/source.json` | 原片身份、元信息和关键帧来源 | 否 |
| `specs/layout.json` | 落定帧、稳定元素 ID、位置、锚点、裁切、层级和静态外观 | 动效与 QA 不得改 |
| `specs/motion.json` | 绑定到稳定元素 ID 的时间行为 | 实现与 QA 不得改 |
| `validation/report.json` | 检查结果、问题归因和已知差异 | 只有 QA 更新 |
| `remotion/composition.tsx` | 可编辑的最终视觉实现 | 由实现阶段维护 |
| `remotion/schema.ts` | 可替换内容与素材接口 | 由实现阶段维护 |

JSON 是跨阶段交接合同，TSX 是最终视觉实现。JSON 不承担描述任意 React 组件树的任务，也不能用一张压平截图替代可编辑组件。

## 稳定元素 ID

- 元素 ID 由布局阶段创建，格式为小写连字符，例如 `hero-card-01`。
- 动效用 `targetId` 引用布局元素，不能按自己的理解重命名。
- `@camera`、`@scene` 和 `@transition` 是保留目标，用于整体镜头、整场和镜头连接。
- 如果下游发现元素拆分错误，写入 QA 问题并把责任阶段设为 `layout`，不得创建第二套元素。

## 证据和置信度

所有重要判断必须声明来源：

- `measured`：由脚本、像素或时间码测得。
- `observed`：从关键帧直接观察，但未精确测量。
- `inferred`：根据可见结果推断制作方式。
- `default`：缺少证据时使用的克制默认值。

置信度使用 `high`、`medium` 或 `low`。压平视频无法唯一确定字体、混合模式、插件或隐藏像素时，不得使用高置信度措辞。

## 裁切与素材完整性

- `viewport-clip`：素材完整，只是超出画布。
- `container-mask`：由父容器、遮罩或 `clip-path` 裁切。
- `asset-crop`：素材文件本身已经裁切。
- `none`：没有裁切。
- `complete`：素材完整，可直接复用。
- `visible-only`：只恢复了原片中可见的区域。
- `unknown`：无法判断隐藏区域是否存在。

不得为了让越界元素完整显示而改变参考构图，也不得将生成式扩图冒充原始完整素材。

## 阶段所有权

1. `preflight` 冻结来源身份和镜头范围。
2. `layout` 冻结落定帧、元素 ID 和最终静态状态。
3. `motion` 只能给已有元素或保留目标绑定时间行为。
4. `implementation` 把规格实现为 Remotion，不重新解释来源。
5. `qa` 只比较、记录和归因；修复由主 Skill 退回责任阶段。

## 修正循环

初版不计为修正轮。`case.json.iteration.maxCorrections` 不得超过 2，`correctionsUsed` 不得超过它。每轮只处理一个最高影响根因或一组同根因问题；两轮后仍未通过时，保存已知差异或阻塞原因。

## 校验

运行：

```bash
node scripts/validate-case.mjs /absolute/path/to/case-directory
```

校验器检查 JSON 可读性、案例 ID 一致性、元素 ID 唯一性、父子引用、运动目标、帧顺序和两轮上限。JSON Schema 位于项目根目录 `schemas/`。
