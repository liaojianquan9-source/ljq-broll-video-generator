# 片段范围与内容范围锁定

完整抽帧前，把用户表达写成机器可验证的范围合同。范围合同决定案例内源片、纳入元素、排除元素和 QA 遮罩。

## 时间范围

统一把中文全角冒号转成半角，并记录：

- `startSeconds`；
- `endSeconds`；
- `durationSeconds = endSeconds - startSeconds`；
- 面向用户的起止描述，例如 `0.000s–11.000s（共 11.000s）`。

标准三段时码 `HH:MM:SS(.fff)` 按小时、分钟、秒解析。自然语言“第 11 秒”“到 11 秒”“只要 11 秒”表达 11 秒位置。两种表达冲突时，先用一句话让用户确认标准化后的起止范围。

用户纠正范围后，以最新明确表达创建新来源版本。预检脚本核对解码时长与预计时长；误差超过一帧时退出。

## 内容范围

把用户要求分成：

- 纳入复刻：贴图、文字、数字、参数、线条、图标、容器、静态材质、逐元素动效、整体镜头与转场；
- 排除：用户明确不要的人物、A-roll、平台水印或其他内容；
- 排除区域的呈现：透明、指定底色或空白，以用户原话为准。

布局只重建纳入项。排除项所在区域按合同显示为透明、指定底色或空白；QA 使用 `exclusionMask` 将这些像素从 B-roll 差异指标中排除。

## 建立案例

```bash
$SKILL_DIR/.venv/bin/python $SKILL_DIR/scripts/inspect-clip.py <video> <case-dir> \
  --start-seconds <start> --end-seconds <end> \
  --include <item> [--include <item>] \
  [--exclude <item> --excluded-region-mode blank --exclusion-mask <mask.png>] \
  --scope-confirmation "<标准化范围与用户确认依据>"
```

脚本精确裁切案例内源片并写入 `case.json.scope`。完成标准：`start < end`、`duration=end-start`、案例内解码帧数与 `duration×fps` 相差不超过一帧、来源哈希有效。

## 何时必须问

歧义会改变起止时间、片段数量、人物/A-roll 是否纳入、排除区域模式或元素可替换性时，先问一个定向问题。

字体名称、插件名称和不可见像素无法唯一确认时，按证据选最接近方案并标注 `inferred` 或已知差异。用户已经给出纠正时直接采用。
