# Paint

一个无构建步骤、无外部依赖的网页绘画程序，可直接作为 GitHub Pages 站点发布。

## 已实现

- 画笔、橡皮擦
- 预设颜色和自定义颜色
- 1 到 64 像素笔刷粗细
- 鼠标、触控笔和触摸输入
- 撤销、重做、清空
- 导出为 PNG
- 高 DPI 画布
- 适配桌面和移动端
- 两人 WebRTC 实时联机
- 邀请码、回答码和邀请链接分享
- 初始画布快照、实时笔画预览和增量同步

## 两人联机

联机不依赖项目自己的后端，绘画数据通过 WebRTC DataChannel 直接传输。

房主操作：

1. 点击工具栏中的“联机”。
2. 点击“创建邀请”。
3. 复制邀请码或分享邀请链接。
4. 收到对方的回答码后粘贴并点击“完成连接”。

加入者操作：

1. 打开邀请链接，或在“加入房间”中粘贴邀请码。
2. 点击“生成回答码”。
3. 将回答码发回房主。

邀请链接使用 URL hash 携带连接信息，hash 不会发送给 GitHub Pages 服务器。邀请码和回答码包含临时网络连接信息，只应发送给联机对象。

当前使用公共 STUN 服务发现公网连接，不使用 TURN，也不转发绘画数据。双方处于对称 NAT、严格企业网络或部分移动网络时可能无法直连；如果要保证所有网络都能连接，就需要部署 TURN 中继服务器。

## 本地预览

项目使用 ES Modules，必须通过 HTTP 打开，不能直接双击 `index.html`。

```powershell
cd C:\Users\zyh\Desktop\Codex\paint
python -m http.server 8000
```

然后打开 `http://localhost:8000`。

## 发布到 GitHub Pages

1. 新建 GitHub 仓库。
2. 将本目录全部文件上传到仓库根目录。
3. 打开仓库的 `Settings`。
4. 进入 `Pages`。
5. 在 `Build and deployment` 中选择 `Deploy from a branch`。
6. 选择 `main` 分支和 `/ (root)` 目录并保存。

项目没有构建产物，发布时不需要运行打包命令。

## 目录

```text
paint/
├── index.html
├── styles.css
├── src/
│   ├── canvas-editor.js
│   ├── history.js
│   ├── network.js
│   └── main.js
└── README.md
```

`CanvasEditor.getSnapshot()` 返回可序列化的当前画布数据。房主建立连接后使用它发送初始快照；绘制过程中发送临时笔画预览，抬笔后由房主分配序号并广播正式笔画。撤销、重做和清空通过快照修正双方状态。
