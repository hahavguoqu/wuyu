# 雾屿

四关固定视角 2.5D 解谜游戏，主工程现为 Godot 4.7.2 / GDScript / Compatibility。网站 `https://wuyu.lanjinjin.site/` 发布 Godot 单线程 Web 导出；建筑、人物、输入、寻路与错觉遮挡均由 Godot 运行。

## 开发与验证

用 Godot 打开 `godot/project.godot`，F5 运行。本机便携引擎位于忽略目录 `artifacts/godot-tools/`。其他机器安装官方 4.7.2 与 Web 导出模板，或设置 `GODOT_BIN` 为引擎路径。

```powershell
./tools/godot.ps1 editor
./tools/godot.ps1 verify
./tools/godot.ps1 playthrough
npm ci
npm test
npm run build
npm run dev
```

预览：`http://127.0.0.1:5180/`。`npm run build` 导入资源、验证四关、导出网页并生成 `dist/`。`dev` 预览 `godot/build/web/`；`preview` 预览最终 `dist/`。

点击道路任意位置移动，点击人物或空格停下。点击机关转一档，或直接拖动并松开吸附。方向键旋转，R 重置，Esc 打开目录；前两关有简短教学，后两关不显示常驻提示。目录可直接选择四关，完成情况与声音设置保存在浏览器中。

四关为「折臂」「双廊」「门阶」「悬阶」。门阶必须两次转动，经过后柱顶再放平；双廊和悬阶需要搭乘旋转横梁。人物保留银发、黄色外衣和双腿行走动画，终点统一使用贴地金色四瓣纹章。

工程结构、特殊遮挡和验证说明见 [godot/README.md](godot/README.md)。移动模型后仍需同步道路数据与错觉接口，尚未提供自动维护接口的编辑插件。

## 网站发布

推送 `main` 后，GitHub Actions 下载并缓存官方 Godot 与单线程 Web 模板，运行原版参考回归测试及 Godot 四关验证，导出并发布 `dist/`。网页不要求跨域隔离响应头。

腾讯云 DNSPod：`wuyu` / `CNAME` / 默认线路 / `hahavguoqu.github.io`。GitHub Pages 自定义域名保持 `wuyu.lanjinjin.site`，强制 HTTPS；导出资源使用相对路径。

## 原版快照

- 原版源码与独立运行配置：`legacy/threejs/`，只作为快照和几何转换参考，不参与线上运行。
- 完整 Git 快照标签：`snapshot/threejs-before-godot-20261009`，提交 `725f0b0be11ab4ee51f5365bf8dadd7242d97785`。
- 本机完整 ZIP：`artifacts/snapshots/threejs-before-godot-20261009.zip`，已忽略。
- 原版预览：`npm run legacy:dev`；构建：`npm run legacy:build`。

正常构建不会重生成模型。`./tools/godot.ps1 bake` 是从快照重新转换四关模型与数据的显式操作，会覆盖对生成场景的手工修改。
