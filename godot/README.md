# 雾屿 · Godot 迁移试作

第一阶段只迁移第三关「门阶」。使用 Godot 4.7.2、GDScript、Compatibility 渲染器；运行时不依赖 Three.js 或 JavaScript 游戏逻辑。现有四关网页版仍保留。

## 打开与运行

在仓库根目录的 PowerShell 中运行：

```powershell
./tools/godot.ps1 editor
```

也可用官方 Godot 打开 `godot/project.godot`，按 F6 运行当前关卡，或 F5 运行工程。本机便携引擎位于忽略目录 `artifacts/godot-tools/`；其他机器通过 `-GodotPath` 指定引擎。引擎和下载包不进入 Git。

点击路面移动，可选择道路中间的位置。直接点击或拖动金色旋钮旋转，松开后吸附到终态；空格停下，R 或右上角图标重新开始。

通关顺序：初始前桥放平 → 越过前桥及两段阶梯 → 第一次立起蓝柱 → 穿过后侧柱顶进入白色回廊 → 第二次放平 → 沿后桥到终点。不能用一次转动完成。

## 工程结构

- `scenes/blue_gate.tscn`：入口场景，实例化建筑和角色。
- `scenes/architecture.tscn`、`scenes/traveller.tscn`：原生可编辑场景，保留原模型和配色；机关、旋钮、角色左右腿均为独立节点。
- `data/blue_gate.json`：当前关卡的源数据，包括道路图、接口姿态、真实碰撞边界和显示深度规则。
- `scripts/navigation.gd`：独立道路图与寻路；不用普通导航网格代替视觉错觉连接。
- `scripts/optics.gd`、`shaders/architecture.gdshader`：整块建筑沿固定相机视线调整显示深度，人物使用脚下道路的同一规则。
- `shaders/self_depth.gdshader`：子视口记录建筑自身的原始深度，防止特殊显示深度暴露内部面；像素容差随表面深度梯度变化，避免 MSAA 与遮挡采样冲突。
- `scripts/blue_gate.gd`：输入、角色移动、转动吸附、连续碰撞检查、相机布局及验证入口。

原生场景可以在编辑器中查看、调整。但目前道路图仍在数据中：移动建筑时，需要同步修改道路节点和光学对接规则，尚未实现自动维护接口的关卡编辑插件。

## 验证与网页预览

```powershell
./tools/godot.ps1 verify
./tools/godot.ps1 web
npm run godot:preview
```

预览地址：`http://127.0.0.1:5180/`。网页使用单线程导出，无需额外跨域隔离响应头。网页导出需要官方 4.7.2 Web 模板；本机已准备 `web_nothreads_debug.zip` 与 `web_nothreads_release.zip`。其他机器可在 Godot 的导出模板管理器中安装。

`verify` 检查两次转动的各段路线、两块柱顶通路、终态断路、181 个旋转姿态的碰撞和旋钮转向。还需在实际渲染中检查中间姿态、完整宽度的接缝与人物遮挡。

当前默认网页引擎的未压缩 WASM 约 40 MB，首屏下载成本明显高于原网页；本地通关验证不代表已完成所有手机浏览器测试。其余三关、音效和完整目录尚未迁入。

## 重新同步源数据

```powershell
./tools/godot.ps1 bake
```

此命令从现有 `src/levels.js`、建筑和角色代码重新导出数据并生成两个原生场景，会覆盖对生成场景的手动编辑；仅在明确需要重新同步时执行。正常运行和网页导出不重新生成场景。
