# B-roll 复刻案例交接合同 1.1

主 Skill 与三个子 Skill 通过同一个案例目录交接。换 Skill、上下文压缩或新任务恢复时，先读取 `case.json`，不能依赖“右边那张图”或聊天记忆。

## 目录与所有权

| 文件 | 责任 | 规则 |
| --- | --- | --- |
| `case.json` | 主 Skill 与当前责任阶段 | 来源、阶段、文件索引、两轮计数 |
| `evidence/source.json` | preflight | 下游不得静默修改 |
| `specs/layout.json` | layout | 冻结落定帧、稳定 ID、几何、裁切、素材与静态外观 |
| `specs/motion.json` | motion | 只绑定 layout ID 或保留目标 |
| `remotion/composition.tsx` | layout/implementation | 可编辑组合入口 |
| `remotion/schema.ts` | layout/implementation | 下次可替换内容、素材和主题接口 |
| `validation/report.json` | QA | 硬门、视觉判断、指标、问题归因和证据 |

JSON 是跨阶段合同；TSX 是可编辑视觉实现。不能用压平截图代替已能拆成文字、媒体、形状和容器的构图。

## 阶段化文件

尚未开始的下游文件在 `case.json.files` 中必须为 `null`。阶段通过后才要求对应文件存在：

- `preflight=passed`：source 与 sourceEvidence
- `layout=passed`：layout、composition、propsSchema
- `motion=passed`：motion
- `implementation=passed`：composition、propsSchema、完整 render
- `qa=passed`：render 与 status=passed 的 validation

这让案例能够在任何阶段合法落盘，同时 `--complete` 仍会要求全部五个阶段和根状态都通过。

## 来源可移植性

`source.path` 保留用户输入的原始绝对路径作为来源记录；`files.source` 必须指向案例目录内的副本。校验器检查副本的字节数和 SHA-256，避免换窗口后原路径失效或素材悄悄变化。

## 稳定元素 ID

- 布局阶段创建小写连字符 ID，例如 `hero-card-01`。
- motion、runtime 与 QA 只引用这些 ID，不能自行重命名。
- `@camera`、`@scene`、`@transition` 是整体运动的保留目标。
- 下游发现拆分错误时，issue owner 设为 layout 并退回，不创建第二套元素。

## 布局合同

`bounds` 为画布百分比 `[left, top, width, height]`，允许元素越界；`anchor` 为元素内部 0..1。每个元素记录类型、内容/素材、父组、zIndex、裁切模式、素材来源/完整性、外观、证据和置信度。

裁切：`viewport-clip`、`container-mask`、`asset-crop`、`none`。素材完整性：`complete`、`visible-only`、`unknown`。生成式补全不得冒充 original。

## 动效合同

平移使用像素，缩放使用倍率，旋转/色相使用度，透明度和 reveal 使用 0..1，帧号为从 0 开始的整数。支持 transform、effects、reveal 与固定 seed 的 textAnimation。所有关键帧必须严格递增并在时间线内。

## 证据与置信度

- `measured`：脚本、像素或时间码测得；
- `observed`：从全分辨率关键帧直接观察；
- `inferred`：根据结果推断的一种可复现实现；
- `default`：缺证据时采用的克制默认值。

置信度使用 high/medium/low。字体、混合模式、原插件和隐藏像素无法唯一确定时不得使用高置信度措辞。

## 两轮修正

初版为 pass 0。`maxCorrections` 固定为 2，必须通过 `begin-correction.mjs` 增加计数并保存前一轮报告。QA 只归因，主 Skill 定向退回责任阶段。第三次修正会被拒绝；此时保存已知差异或请求新证据。

## 校验

公开仓库入口：

```bash
node scripts/validate-case.mjs /absolute/path/to/case-directory
```

安装后的自包含入口：

```bash
node /path/to/ljq-broll-replica/scripts/validate-case.mjs /absolute/path/to/case-directory --complete
```

校验器实际应用 JSON Schema，并检查案例内路径、源文件哈希、元素/父组、运动目标、时间线、媒体元信息、QA 状态和两轮上限。根目录 schema 与主 Skill 内 schema 由 `scripts/sync-schemas.sh` 保持一致。
