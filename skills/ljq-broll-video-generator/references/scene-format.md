# Scene JSON 格式

`scene.json` 同时描述静态布局和动态运动，是视频的唯一可编辑真源。用户不需要手写这个文件。

## 顶层结构

```json
{
  "schemaVersion": "1.0",
  "id": "example-scene",
  "renderMode": "reference",
  "canvas": {
    "width": 1280,
    "height": 720,
    "fps": 30,
    "durationInFrames": 120
  },
  "theme": {
    "background": "#181818",
    "backgroundImage": "repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px)",
    "backgroundSize": "auto",
    "backgroundPosition": "center",
    "foreground": "#f0f0f0",
    "surface": "#5f5f5f",
    "muted": "#969696",
    "accent": "#ef4444"
  },
  "focus": ["main-card"],
  "groups": [],
  "elements": []
}
```

`backgroundImage`、`backgroundSize` 和 `backgroundPosition` 为可选 CSS 背景字段。它们适合低对比纹理、渐变和暗角，不应用来承载必须独立运动的主体内容。

## 两种渲染模式

- `reference`：用低噪黑白灰占位块显示结构、标签和运动。图片与视频不会显示真实内容。
- `final`：显示真实文字、图片、视频、颜色和样式。

切换模式不能改变元素 ID、布局或运动。如果真实内容放入后需要改位置，应记录为项目实例覆盖，不反向污染模板。

## 坐标

- `box` 使用 `[x, y, width, height]`，单位是画布百分比。
- `from` 和 `to` 使用 `[x, y]`，单位也是画布百分比。
- `x`、`y` 运动属性表示相对基础位置的百分比偏移，不是最终绝对位置。
- `zIndex` 越大越靠上。

## 元素类型

## 父级分组

多个元素需要作为一个整体移动时，使用顶层 `groups`，不要给每个元素复制一遍相同关键帧：

```json
{
  "id": "text-group",
  "label": "整组文字",
  "elementIds": ["title", "highlight", "support", "body"],
  "tracks": [
    {
      "property": "x",
      "easing": "out-cubic",
      "evidence": "observed",
      "keyframes": [
        {"frame": 0, "value": -12},
        {"frame": 20, "value": 0}
      ]
    }
  ]
}
```

父级运动先作用于整组内容，元素自身的 `tracks` 再表达局部动效。一个元素当前只能属于一个父级分组。

### Shape

```json
{
  "id": "main-card",
  "type": "shape",
  "label": "人物卡片",
  "box": [55, 14, 34, 38],
  "zIndex": 20,
  "shape": "rounded",
  "tone": "foreground",
  "fill": "#f5f5f5",
  "texture": "repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 3px)",
  "textureSize": "100% 3px",
  "boxShadow": "0 0 8px rgba(255,230,120,0.18)"
}
```

`shape` 支持 `rectangle`、`rounded`、`circle`。`texture`、`textureSize`、`texturePosition` 和 `boxShadow` 用于有明确画面证据的材质层；低噪参考中保持克制。

### Text

```json
{
  "id": "title",
  "type": "text",
  "label": "主标题",
  "content": "新的真实标题",
  "box": [18, 23, 42, 18],
  "zIndex": 30,
  "tone": "foreground",
  "fontSize": 72,
  "fontWeight": 500,
  "align": "left",
  "letterSpacing": 1,
  "textShadow": "0 0 14px rgba(255,255,255,0.35)",
  "gradient": "linear-gradient(180deg, #ffffff, #7aa7ff)"
}
```

`gradient`、`textShadow` 和 `letterSpacing` 都是可选字段。普通低噪参考不使用它们；只有真实内容需要表达明确的标题层级时才添加。

当同一行文字因为与活动色块进行“差值”合成而出现黑白变化时，不得使用 `segments` 预先上色。标题只写一个 `content`，整个文字层统一使用 `mixBlendMode: "difference"`；黄色底是另一个独立形状元素：

```json
{
  "id": "main-title",
  "type": "text",
  "box": [8, 20, 84, 14],
  "fontFamily": "Ljq Source Han Serif CN, serif",
  "fontSize": 56,
  "fontWeight": 600,
  "letterSpacing": -1,
  "color": "#ffffff",
  "mixBlendMode": "difference",
  "noWrap": true,
  "content": "普通标题高亮标题"
},
{
  "id": "title-highlight-bg",
  "type": "shape",
  "shape": "rectangle",
  "fill": "#ead98b",
  "box": [41.3, 24.55, 43.8, 9.7],
  "zIndex": 8,
  "transformOrigin": "left bottom",
  "tracks": [
    {
      "property": "scaleY",
      "easing": "out-cubic",
      "keyframes": [
        {"frame": 0, "value": 0.025},
        {"frame": 22, "value": 1}
      ]
    }
  ]
}
```

这个标题模块一共只有两个元素：一个完整的 `main-title` 文字元素，以及一个独立的 `title-highlight-bg` 黄色底元素。文字压在深色背景上时由差值计算为白色；黄色底经过时，同一个字由差值计算为深色。文字内容和样式从始至终没有切换。

只有当参考画面明确证明字符本身预先使用不同颜色时，才允许使用 `segments`。差值效果不能用字符分段模拟。

正文逐字生成时使用 `revealMode: "characters"`，并让 `reveal` 从 0 变到 1。`textIndent: 2` 表示首行缩进两个字宽；`lineHeight` 和 `verticalAlign` 分别控制行距和内容在文本框中的垂直位置。

文字需要“逐字从右下方跃入、略微越过基线后回落”时，使用轻量 Remotion `jump-in` 预设：

```json
{
  "textEntrance": {
    "preset": "jump-in",
    "startFrame": 0,
    "durationInFrames": 36,
    "intensity": 1
  }
}
```

`durationInFrames` 是整段文字入场的总时长；字与字之间的错峰、单字弧线和淡入会按字数自动换算。`intensity` 默认为 0.26，这是根据 1920×1080 实际导出片的像素位移校准值；它只调整位移幅度，不改变时序。整组横向运动仍然放在父级 `groups`中，不与单字入场混在一起。

### Image

```json
{
  "id": "media-image",
  "type": "image",
  "label": "产品图片",
  "src": "/absolute/path/product.png",
  "box": [58, 18, 32, 56],
  "zIndex": 20,
  "fit": "cover"
}
```

本地绝对路径或相对 `scene.json` 的路径会在渲染前复制进 Remotion 暂存目录。`fit` 支持 `cover`、`contain`、`fill`。

### Video

```json
{
  "id": "person-video",
  "type": "video",
  "label": "人物视频",
  "src": "./assets/person.mp4",
  "box": [4, 12, 42, 76],
  "zIndex": 10,
  "fit": "cover",
  "playbackRate": 1
}
```

视频默认静音。第一稿不处理音频混合。

### Line

```json
{
  "id": "connector",
  "type": "line",
  "label": "关系线",
  "from": [30, 44],
  "to": [68, 35],
  "zIndex": 15,
  "tone": "accent",
  "lineWidth": 3
}
```

线条使用 `reveal` 属性从 `from` 端向 `to` 端揭示。

## 属性关键帧

每个元素可以包含 `tracks`：

```json
{
  "tracks": [
    {
      "property": "opacity",
      "easing": "out-cubic",
      "evidence": "observed",
      "keyframes": [
        {"frame": 8, "value": 0},
        {"frame": 20, "value": 1}
      ]
    },
    {
      "property": "scale",
      "easing": "out-back",
      "evidence": "default",
      "keyframes": [
        {"frame": 8, "value": 0.78},
        {"frame": 28, "value": 1}
      ]
    }
  ]
}
```

属性：

- `x`：水平偏移，画布百分比。
- `y`：垂直偏移，画布百分比。
- `scale`：缩放倍数，默认 1。
- `scaleX`：只控制横向缩放，默认 1。
- `scaleY`：只控制纵向缩放，默认 1；配合元素的 `transformOrigin: "left bottom"` 可实现高亮从下向上贴入。
- `rotation`：旋转角度，单位度，默认 0。
- `opacity`：透明度，0 到 1。
- `blur`：模糊半径，单位像素。
- `reveal`：默认从左到右或沿线条方向揭示；文字设置 `revealMode: "characters"` 时表示当前已经出现的字符比例，0 到 1。

缓动：`linear`、`in-out-cubic`、`out-cubic`、`out-back`。

证据：

- `measured`：通过脚本或逐帧数据测量。
- `observed`：从画面中明确观察到，但没有精确测量。
- `inferred`：根据上下文推断。
- `default`：没有参考视频时使用的设计默认值。

## 周期运动

轻微漂移或摆动使用 `oscillations`：

```json
{
  "oscillations": [
    {
      "property": "rotation",
      "start": 28,
      "end": 120,
      "amplitude": 1.8,
      "period": 90,
      "phase": 0.2,
      "evidence": "observed"
    }
  ]
}
```

只允许对 `x`、`y`、`scale` 和 `rotation` 使用周期运动。周期运动与关键帧结果相加。

## 最小约束

- 元素 ID 必须唯一。
- 非线条元素必须有合法 `box`。
- 线条必须有 `from` 和 `to`。
- 关键帧按时间递增，至少包含一个点。
- `target` 不单独存在；运动直接挂在元素上，避免第一稿产生跨文件引用错误。
- 参考图里不可复用的具体内容放进项目实例，不写进模板结构。
