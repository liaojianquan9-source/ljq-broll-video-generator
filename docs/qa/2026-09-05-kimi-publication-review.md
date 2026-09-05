# KIMI 0–11秒：发布前复查

日期：2026-09-05。使用模型：**GPT-6 Astra**；复刻实现：**Remotion 4.0.518**。

这次发布包含四Skill规则更新、工具补充、使用说明及[真实案例展示](../../examples/kimi-k3-000-011/README.md)。不修改已获用户认可的原始布局、动效或成片。

## Skill整理

保留总控replica和layout、motion、QA三个阶段Skill；不新增第五个Skill。按`writing-for-agents`把主流程、条件参考和确定性脚本分开：

- layout维护比例、可见字面/alpha边界、主色角色，以及对象/属性两轴分类和蒙版关系；
- motion维护实际composition入口、camera作用域、变换顺序、静态底值/动态增量和逐字替换结束帧；
- replica维护工具选择、副作用、批准基准保护、有限恢复分支和案例迁移测试；
- QA维护人工认可与机器门分离、时变排除限制及实际播放/采样证据。

蓝白主题、人物白底和具体坐标属于本例，不作为新参考的默认参数。较低成本模型尚未做同输入实际制作测试。

## 独立复查与回归

| 检查 | 结果／范围 |
| --- | --- |
| 活动Skill审查 | 50条本地Markdown链接存在；14个Node/Shell脚本语法及8个Python AST检查通过 |
| 安全still工具 | 解析82/164/247/329批准帧；static模式强制motionEnabled=false；新目录输出；dry-run不写状态 |
| contracts | 合法合同通过，重复ID、缺目标、截图文字、分段easing、缺替换证据等负例拒绝 |
| preflight | 0.5–1.6秒得到11帧；倒置范围、未指定排除显示模式被拒绝 |
| motion | 跟踪、时间线、边缘测量工作；1个实际空间窗口的平滑曲线通过，反向负例失败 |
| runtime | 揭示像素数0→4950→10000，方向/完成态正确；文字中间态与最终态不同 |
| QA | 尺寸错误、缺人工门、证据文件缺失均阻断；齐备后通过 |
| workflows | 两轮允许，第三轮拒绝 |
| e2e | 临时纯色案例15帧完整解码、替换与11项gate、complete校验通过；平均RGB差0.666667<4 |

七组回归均退出0。e2e是纯色静态fixture，空间连续性windows=0，不能作为复杂动线覆盖证明；motion独立测试有非零窗口。测试使用临时fixture，不改真实KIMI合同/QA或已安装Skill源码；正常构建会刷新Webpack缓存。

## 公开源码包补测

实际运行了[案例README](../../examples/kimi-k3-000-011/README.md)中的`npm run still`，生成1280×720第247帧；实际观看为KIMI·K3及月球背景。另以`motionEnabled:false`、`kimiTitle:EDITABLE`导出独立替换图，确认新标题生效且旧KIMI无残留。

这两项复用了本机已安装依赖，不等同于干净环境`npm ci`测试。独立package-lock由npm生成；商业/系统字体未打包，跨机需要自己取得可用字体并重验字面比例。输出和依赖symlink由gitignore排除。

## 展示媒体核对

- 上下对照：1280×1680、H.264、30fps、11秒、330帧、无音轨；两幅内容各保持1280×720、不裁切。
- 标签：顶部“原视频效果”、中间“生成的复刻效果”、底部“GPT-6 Astra + Remotion”；标签不盖住画面。
- 静帧：82、164、247、329四个零基帧，同一时间上下对应；四张均已查看。329的白底是排除口播的设计范围。
- GIF：480×630、10fps、完整11秒，仅预览，不作保真/时序门。
- 标签采用Swift/AppKit纯文本绘制，再由FFmpeg合成；这是本机FFmpeg缺少drawtext的替代实现，不是AI图像重绘。

输入未被改写。纯Remotion成片SHA-256仍为：

```text
882f2e47a082e323ee2d9a34a6a74f123a4f718f262f557cb43b9108aebe5536
```

输出哈希、元信息和可移植命令在[媒体清单](../../examples/kimi-k3-000-011/media/publication-manifest.json)。该清单的通过结果只针对合成产物技术检查。

## 人工认可与自动QA

用户已明确认可静态、动态整体效果，并接受少量瑕疵。真实case普通validator通过（42元素、26motion、修正1/2）；complete仍按预期拒绝：QA/status待审，时变排除区缺少可正确表达的mask。

比较器目前只支持单张静态mask。不能用大范围遮罩遮住中段B-roll，也不能用全黑占位文件绕过门禁。因此公开说明保留“人工认可、自动保真QA待审”，不宣称精确字体、原工程参数或跨模型质量已验证。

## 发布边界

发布精选展示、实际运行源码、动效规格、元素摘要、两张独立NASA素材、字体候选证据，以及四Skill维护文件。原始长视频、私人绝对路径、token、日志、依赖、编译缓存和整套本地逐帧证据不加入新提交。历史案例及版权声明保留，不以新案例替换或改写旧结果。

原片参考部分及第三方字体不随MIT重新授权。NASA来源与署名见[素材来源](../../examples/kimi-k3-000-011/remotion/public/moon/SOURCES.md)，所有第三方边界见[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
