# 工具选择与可重复执行

新案例、恢复任务、选择工具或批量渲染前读取。流程以可检查产物交接，不依赖某个模型名、上一次聊天或临时浏览器句柄。阶段通过条件仍由[routing.md](routing.md)及阶段Skill维护。

## 先取出本次约束

从用户最新消息和case合同确认：连续时间范围、这轮停止阶段、纳入/排除项及底色、源帧能否用于非文字资产、已批准静帧、用户接受的小差异、参考主色角色。保存到现有scope/knownDifferences及案例内用户确认记录，不新增任意schema字段。

用户只要静帧时止于静帧；用户确认后才接动效。用户认可观感、机器合同通过、全片技术检查与自动保真QA是不同事实，分别记录。后续只要求更新Skill时，不顺便改已确认的成片。

## 选择最小够用的工具

下表是决策与副作用提示，不是完整CLI手册。`R/L/M/Q`分别指replica/layout/motion/QA的实际Skill目录；从已加载Skill定位，文件路径用引号。Python参数用已支持的`--help`核对；Node/shell先读Usage或入口，不能假设它们都支持`--help`。

| 需要证明什么 | 首选入口或方法 | 完成证据／失败分支 |
| --- | --- | --- |
| 来源与精确范围 | R的`inspect-clip.py`；恢复先`validate-case.mjs` | 实际解码、哈希与scope一致。已有案例不以`--force`重做预检；它会重写状态/证据 |
| 全段排版变化 | FFmpeg缩略联系表＋边界附近原分辨率帧 | 场景列表与每场落定帧。联系表定位后必须看原尺寸；不以缩略图读小字/细线 |
| 元素比例与字体 | 源帧可见边界；最终字体加载后测量 | 按[静态规则](../../ljq-broll-layout-structure/references/static-compositing.md)留对照；Canvas可测字面，生产图形仍用live文本 |
| 独立纹理或媒体 | 先用户资产，再可核对来源的素材 | 按[素材恢复](../../ljq-broll-layout-structure/references/asset-recovery.md)；找不到影响主体的资产则记录限制或请求，不能用源截图绕过限制 |
| 出现、位移、擦显 | M的`extract-analysis-frames.sh`、`motion_track.py`、`element_timeline.py`、`edge_trace.py` | 参数适用的ROI、零基帧映射、采样表。抽帧脚本会跳过已有目录，先核对来源与数量；工具结果须原帧交叉验证 |
| 定量库缺失或ROI失效 | 已有Pillow/NumPy做简单边缘/相关测量；或人工界定区间 | 保留口径与误差。纯渐变、遮挡、轮廓短弧换探针，不为了补一个包重建环境或伪造小数精度 |
| 安全批量still | R的`render-review-stills.mjs` | 单次bundle/浏览器，输出新目录＋manifest，状态保持不变；先读`--help`，静态控制与视觉正确性仍需检查 |
| 正式场景／替换登记 | L的`render-layout-scene.sh`、`render-replacement-still.sh` | 会初始化工程、暂存资产、按需安装依赖/创建链接，覆盖目标still并回写状态，默认needs_review。仅新基准或明确修正使用；先生成/观看，再给具体通过判断 |
| 动效合同连续性 | R的`analyze-motion-continuity.mjs` | 写回motion；检查窗口数量和覆盖。它不验证实际runtime、逐字/模糊逻辑或成片播放 |
| 完整交付视频 | R的`render-case.sh` | 保留既有composition；会暂存素材、渲染并推进implementation。登记仅证明文件存在，帧数/音频另查 |
| 全片差异与门禁 | Q的`qa-case.py`＋R的`record-qa-gates.mjs` | QA默认review也会写状态并解码全片；不能用作只读查询。只读查看现有report与validate |
| 最终确认 | R的`validate-case.mjs --complete` | 全部完成才通过；失败保留实际状态和可用产物，按owner处理，不编辑状态来绕过 |

终端/文件工具优先完成抽帧、测量、生成和校验；浏览器用于播放器、Studio和视觉行为验证。运行时能力以当前提供的工具、已安装库/脚本为准；API不确定先读本地类型/代码或官方文档。复用现有Remotion工程；依赖缺失时才走明确的环境准备，`setup-environment.sh`会安装依赖，不是只读探测。

## 静态基准与动态实现交接

1. 用户确认后保存批准still、对应源码/props与frame的版本，动效代码基于该实现增量接入。完成：能独立恢复批准状态，不以通用模板替换它。
2. 为新实现设置可验证的静态模式，例如实际消费`motionEnabled=false`；没有该能力时先补入口或使用独立静态composition。完成：static与motion的模式不会仅靠文件名区分。
3. 在独立路径导出每场批准frame的静态回归和代表性motion探针，另跑长文案/不同图片比例替换。完成：静态几何/材质没有回退，动态入口/切点/终帧可见，替换无旧内容残留。
4. 最后才完整渲染；先核对最有辨识力的探针，避免每改小值就盲目重渲染。完成：实际入口、props、依赖资产、最终MP4与记录一致。

安全still示例（`CASE`为当前案例；`PROBE_FRAMES`为依据本片证据选出的逗号分隔零基帧号）：

```bash
node "$R/scripts/render-review-stills.mjs" "$CASE" --mode static --dry-run
node "$R/scripts/render-review-stills.mjs" "$CASE" --mode static
node "$R/scripts/render-review-stills.mjs" "$CASE" --mode motion --frames "$PROBE_FRAMES"
```

dry-run只检查计划，不证明composition消费静态开关；probe成功也不自动批准。通用旧静帧脚本没有关闭动效开关，直接重跑可能覆盖已批准基准；替换props同样必须明确模式。源码中的实际消费逻辑及渲染结果才是证据。

## 降低执行负担

- 一个阶段一次只处理一个场景或同根因问题组，完成其证据再继续；恢复只加载相关合同与参考，不反复灌入整段历史。
- 原子重复工作交给已验证脚本；将测量点、候选与结论写成短表，不靠“自行理解画面”或“按上次方式”指令。
- 有并行代理时，可拆成只读取证、独立素材溯源、代码审查；每项注明输入、输出路径、禁止改的文件。主代理维护同一份合同与源码，未给权限时子代理不写它们。没有代理能力时顺序执行同样的检查点。
- 降低成本优先减少重复抽帧/安装/bundle/全片渲染，不能删掉原分辨率判断、替换或关键帧验收。较低成本模型是否足够需同一输入和验收条件的对照测试；本案例获认可不等于所有模型或新片都已验证。
- 只把外部可检查的决策条件、工具输入输出和纠错经验固化，不把模型名、临时绝对路径、tab/PID、一次性提示词或未验证的原参数当工作流依赖。

## 异常与停止

素材、字体、许可或工具限制会改变用户意图时请求必要信息；仅影响近似精度时保留置信度和已知差异。达到用户当前阶段就交付；没有授权不进入下一阶段。正式QA失败按[质量循环](quality-loop.md)处理；调试探针与重跑同一QA报告不等于新增纠正轮次，也不能借此进行无限完整修正。

有时变排除区或自动QA能力不足时必须读[QA限制](../../ljq-broll-fidelity-qa/references/quality-gate.md#时变排除与能力限制)。报告人工认可与自动待审两种状态，既不隐瞒限制，也不阻止交付已完成的预览。
