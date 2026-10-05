# 雾屿 · 第五版

原创 2.5D 解谜原型。六关全部采用固定正交视角，重点探索错层道路在画面中的连接。象牙色建筑、灰绿色细支撑表示固定结构，青绿色仅用于可移动的台面和柱体；金色转柄直接控制机关。前两关有简短教学，后四关不显示常驻提示。终点是贴地四瓣纹章。

## 运行

```sh
npm install
npm run dev
npm test
npm run build
```

打开 http://127.0.0.1:5173 。构建产物在 `dist`。

## 发布到 GitHub Pages

项目已提供 `.github/workflows/deploy-pages.yml`。推送到 `main` 或 `master` 后，工作流会安装依赖、运行游戏测试、构建并发布 `dist`。也可以在 Actions 页面手动运行。`vite.config.js` 使用相对资源路径，兼容 GitHub 默认项目地址和自定义域名。

1. 在 GitHub 创建仓库。使用 GitHub Free 时，Pages 需要公开仓库，上传的源代码也会公开。首次创建建议不勾选自动生成 README，方便推送已有项目。
2. 上传本项目源文件，包括隐藏目录 `.github`、`public`、`src`、`test`、`index.html`、`package.json`、`package-lock.json`、`vite.config.js`、`.gitignore` 和本 README。无需上传 `node_modules`、`dist` 或 `artifacts`。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
4. 打开 **Actions → Deploy game to GitHub Pages → Run workflow**。完成后在 Pages 页面查看实际网站地址。

如果使用 Git 推送到 `hahavguoqu/wuyu`，新仓库的命令如下：

```powershell
git init -b main
git add .github public src test index.html package.json package-lock.json vite.config.js .gitignore README.md
git commit -m "Prepare Mist Isles for GitHub Pages"
git remote add origin https://github.com/hahavguoqu/wuyu.git
git push -u origin main
```

### 绑定 wuyu.lanjinjin.site

先在仓库 **Settings → Pages → Custom domain** 填写 `wuyu.lanjinjin.site` 并保存，再在当前 DNS 服务商添加解析。若仍使用腾讯云 DNS，就在 DNSPod 添加：

| 字段 | 内容 |
| --- | --- |
| 主机记录 | `wuyu` |
| 记录类型 | `CNAME` |
| 线路 | 默认 |
| 记录值 | `hahavguoqu.github.io` |
| TTL | 默认 |

记录值不包含 `https://`、仓库名称或任何路径。同名旧 A、AAAA 或 CNAME 记录需要先处理，避免冲突。此流程不需要更换域名的 DNS 服务器；如果已经改用 Cloudflare DNS，则在 Cloudflare 添加解析。

等待 GitHub 的 DNS 检查和证书签发完成，再开启 **Enforce HTTPS**。DNS 变更及 HTTPS 就绪可能需要最多 24 小时。GitHub Actions 发布方式通过仓库设置绑定域名，无需在项目中增加 `CNAME` 文件。

官方说明：[Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。

## 六关

| 关卡 | 视角 | 玩法 |
| --- | --- | --- |
| 初见 | 固定 | 点击路径行走，上桥后拖动金色转柄旋转，松手接向终点。 |
| 浮渡 | 固定 | 搭上轨道台面，沿轨道方向拖动转柄移动平台。 |
| 折庭 | 固定 2.5D | 庭院上下错层的道路投影重合后可以通行，连接处的实际深度不同。 |
| 云阶 | 固定 | 搭乘升降台，向上拖动转柄进入高处的路径。 |
| 回廊 | 固定 2.5D | 一整段折角路径旋转；两端分别通过不同高度、深度的投影连接接入建筑。 |
| 镜潮 | 固定 2.5D | 沿斜向轨道移动台面，让终点与高处错层道路在画面中相接。 |

点击路径上的任意位置停留，人物按真实转角走路。旋转转柄支持横向拖动与绕转柄的圆弧拖动；移动、升降转柄按屏幕中轨道的方向拖动，松手自动吸附到站点。行走中可改变落点，点击人物或暂停图标停下，拖动机关也会先停止行走。旅人保持平台内的局部位置随机关移动，包括折角台面。指针取消或窗口失焦会回到拖动前的站点。键盘 Enter 操作转柄，左右方向键旋转，Tab 选择交互点。目录保留选关、进度、暂停和继续；沿用 `mist-isles-phase3` 存档，不清空已完成关卡。

固定道路在接缝处收短，轴座采用象牙色；轨道支撑与升降导轨移出移动柱体的范围。`src/mechanism.js` 用实际三维结构的定向包围盒检测穿入，拖动及吸附动画分步检查完整经过的路径，遇到障碍停在最后一个安全位置。正常六关可完整旋转、往返平移或升降。

## 美术与实现

- `src/character.js`：银白短发、黑色发带、金色星形发夹、黄色外衣和短靴；双腿交替行走，手臂和衣摆随动。
- `src/architecture.js`：程序化窄路、方柱、折角旋转桥、斜向轨道和升降导轨；固定与可动结构采用不同材质。转柄跟随机关转动，四瓣纹章贴合终点地面；取景覆盖完整运动范围。
- `src/levels.js`：六关参数、路径转角、平台站点和相机平面投影误差。
- `src/navigation.js`：连续道路位置、端点连接、任意位置的最短路线。视角错觉以世界端点的真实投影计算连接。
- `src/main.js`：直接交互、移动平台动画、平滑转向、固定视角取景、目录、进度与资源释放。
- `src/interaction.js`：双向旋转吸附、跨越角度边界的圆弧拖动、按投影轨道计算平移与升降距离。
- `src/mechanism.js`：固定与移动结构的碰撞体、运动检查和障碍前停止。
- `test/levels.test.js`：16 项检查，覆盖六关可解性、1446 个运动采样位置的结构分离、快速拖动防穿透、折角台面搭乘、真实投影连接、路面覆盖、转柄可见性、拖动吸附和双腿行走。

支持触控、键盘焦点、可选音效和减少动态效果偏好。移动机关使用实际三维台面；参考人物以程序化造型实现，未把参考照片上传到公开仓库。镜潮使用风格化淡色倒影。
