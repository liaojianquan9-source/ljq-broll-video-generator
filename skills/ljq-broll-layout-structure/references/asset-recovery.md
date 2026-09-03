# 素材恢复与裁切判断

## 先区分三个事实

1. 素材文件是否完整：`complete`、`visible-only`、`unknown`。
2. 可见区域为什么变少：`viewport-clip`、`container-mask`、`asset-crop`、`none`。
3. 素材从哪里来：`original`、`found`、`extracted`、`recreated`。

这些字段不能互相替代。一个完整 PNG 可能被画布裁切；一个 visible-only 提取物也可能没有任何运行时 mask。

## 恢复顺序

- 优先使用用户提供或案例原始素材。
- 能从源帧无歧义抠出的元素保存到 `assets/extracted/`，并保留提取帧证据。
- 能用标准 HTML/CSS 精确表达的几何形状和文字可以 `recreated`。
- 群内协作包或外部素材只有在获得使用许可后才能进入公开案例，并在第三方说明中记录来源。
- 不用生成式扩图补造不可见区域，也不把重绘素材标成 original。

## 越界元素

若元素只是放在画布边角、部分看不见，优先保留完整素材和超出画布的真实 bounds，使用 `viewport-clip`。不要先裁掉素材再把它误判为 `asset-crop`。

## 提取限制

背景复杂、运动模糊、被遮挡或隐藏面积过大时，提取结果只能是 `visible-only` 或 `unknown`。把缺口记为已知差异，避免为追求“完整”而改变原构图。
