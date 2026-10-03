# 雾屿 · 第三版

原创 2.5D 解谜原型。柔和配色、正交三维建筑、固定投影视觉错觉与可旋转庭院。新版有六关，前两关合并行走、旋转和搭乘平台教学；后四关侧重错层接路、升降建筑与视角变化。

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
| 初见 | 固定 | 点击道路行走，上桥后点击珊瑚红支柱旋转，接向终点。 |
| 浮渡 | 固定 | 搭上轨道台面，点击红柱平移到另一端。 |
| 折庭 | 固定 2.5D | 庭院上下错层的道路投影重合后可以通行，连接处的实际深度不同。 |
| 云阶 | 固定 | 搭乘升降台进入高处的庭院，台面沿金色导轨上下移动。 |
| 回廊 | 可转 | 旋转桥梁，再转动庭院视角，让错位道路接合。 |
| 镜潮 | 可转 | 平移台面与转视角组合，浅水倒影、重叠拱廊和面向画面的圆环形成混合视觉。 |

点击道路上的任意位置停留。行走中可改变目标或点击「停下」。台面上的旅人会保持局部位置随平移、升降和旋转移动。路径断开时禁止通行，支持回程。目录可选关、查看通关进度、暂停和继续。新关卡使用独立的 `mist-isles-phase3` 浏览器存档，保留旧版存档。

## 美术与实现

- `src/character.js`：圆顶宽檐帽、暖色脸部、短斗篷、两条可摆动的腿；步行动画带动手臂、灯笼和衣摆，停止时恢复站姿。
- `src/architecture.js`：原创程序化建筑、瓦垄屋顶、细柱亭子、轨道台面、升降导轨和庭院构图。亭子移至道路后方，四根柱子与道路保持身体通行间距，檐下高度足够容纳人物。
- `src/levels.js`：六关参数、平台站点、亭子间距和相机平面投影误差。
- `src/navigation.js`：连续道路位置、端点连接、任意位置的最短路线。视角错觉以世界端点的真实投影计算连接。
- `src/main.js`：交互、移动平台动画、平滑转向、视角动画、屏幕自适应取景、目录、进度与资源释放。
- `test/levels.test.js`：六关可解性、搭乘位置保持、平台途中断路、真实投影连接、中途回头、亭子通行间距与双腿交替动画。

支持触控、键盘焦点、可选音效和减少动态效果偏好。纸桥及二维人物过桥设定已移除，移动机关使用实际三维台面。镜潮的浅水倒影为风格化淡色倒影。
