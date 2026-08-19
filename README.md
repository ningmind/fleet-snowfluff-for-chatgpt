# Fleet Snowfluff for ChatGPT

为 macOS 版 ChatGPT Desktop 添加高清壁纸、Light/Dark 毛玻璃界面和可交互像素桌宠。

<img width="1470" height="845" alt="image" src="https://github.com/user-attachments/assets/2bec8fc6-5a88-4d37-b58b-84fe86e75b3a" />

<img width="1470" height="845" alt="image" src="https://github.com/user-attachments/assets/438d8a94-c80b-403a-ab76-98557d4a11bc" />

> **非官方项目。** 本项目不隶属于 OpenAI，也不是 ChatGPT 插件。它通过仅监听本机的 Electron DevTools 接口在运行时注入样式，不修改 `ChatGPT.app`、`app.asar` 或应用签名。

## 功能

- 🖼️ 高清壁纸：全屏 `cover`，主内容区不使用模糊滤镜
- 🧊 双主题玻璃：Light/Dark 分别设置主区、侧栏、输入框和浮层
- 🐾 像素桌宠：待机、组织回复、工作、等待、失败和庆祝动画
- 🖱️ 桌宠交互：点击随机反应、拖动并记忆位置、右键菜单、隐藏与重新召唤
- 🔄 热更新：运行期间修改 CSS 或桌宠脚本会自动重新注入
- ↩️ 完全可撤销：正常退出主题会话后，用常规方式启动 ChatGPT 即恢复官方界面

## 当前视觉参数

透明度越高，玻璃底色越厚，壁纸越不明显。

| 区域 | Light | Dark | 模糊 |
|---|---:|---:|---:|
| 全局壁纸遮罩 | 8% 浅蓝白 | 18% 深蓝黑 | 无 |
| 主内容区 | 75% 珍珠白 | 70% 深蓝黑 | 无 |
| 左侧菜单栏 | 40% 浅蓝白 | 40% 蓝黑玻璃 | 16px |
| Light 输入框 | 12% 浅蓝白 | 跟随应用深色玻璃变量 | 10px / 应用默认 |
| Pinned Summary | 46% 浅蓝白 | 48% 蓝黑 | 16px |

## 系统要求

- macOS
- ChatGPT 安装在 `/Applications/ChatGPT.app`
- Node.js 22 或更高版本
- 本机端口 `9229` 可用；可通过 `CHATGPT_THEME_PORT` 更改

这是针对当前 macOS ChatGPT Desktop DOM 结构实现的实验性主题。应用更新可能改变类名或组件结构，需要同步调整 `src/theme.css`。

## 安装与启动

```bash
git clone https://github.com/ningmind/fleet-snowfluff-for-chatgpt.git
cd fleet-snowfluff-for-chatgpt
chmod +x ./start.command
./start.command
```

启动前请用 **Cmd+Q** 完全退出已运行的 ChatGPT。主题会话需要保留终端窗口；关闭 ChatGPT 或按 `Ctrl+C` 会停止注入器。

也可以在 Finder 中双击 `start.command`。如果 macOS 首次阻止运行，请在“系统设置 → 隐私与安全性”中确认，或在终端执行上面的命令。

## 更换壁纸

用自己的 JPG 替换：

```text
assets/wallpaper.jpg
```

也可修改 `start.command`，向 `src/injector.mjs` 传入其他 JPG、PNG、WebP、GIF 或 AVIF 文件路径。

## 桌宠状态

ChatGPT Desktop 没有公开、稳定的工具事件接口，因此本项目只检测界面上相对稳定的可见状态，不假装区分每一种工具调用。

| ChatGPT 状态 | 动画 | 气泡 |
|---|---|---|
| 提交消息 | `chatting` | 正在组织回复… |
| 持续回复或工作 | `running` | 正在工作… |
| 等待批准 | `waiting` | 等待你的指示… |
| 明确错误提示 | `failed` | 好像遇到问题了… |
| 工作结束 | `celebrating` | 完成啦！ |
| 空闲 | `idle` | 无常驻气泡，偶尔随机互动 |

状态检测是启发式的：界面语言、ChatGPT 版本和按钮文案变化都可能影响识别。

## 桌宠交互

- 左键点击：随机动画与台词
- 左键拖动：移动位置，位置保存在 ChatGPT 的本地存储中
- 右键：打开快捷菜单
- 隐藏后：使用页面右下角的召回按钮重新显示

精灵图在构建时使用最近邻重排为固定 `144 × 156` 单元，运行时不进行小数缩放。Light 模式使用单独图集，只柔化透明边缘附近的深色轮廓。

## 调整主题

主要参数位于 [`src/theme.css`](src/theme.css) 顶部及对应 Light/Dark 区块：

- `--codex-wallpaper-dim-light` / `--codex-wallpaper-dim-dark`：全局壁纸遮罩
- `main[class*="_MainContentSurface_"]`：主内容区透明度
- `aside`：左侧菜单栏透明度与模糊
- `[class*="_ComposerLayoutRoot_"]`：输入框玻璃
- `--codex-glass-blur`：通用浮层模糊值

保存文件后，运行中的注入器通常会在约 1.5 秒内重新加载。

## 项目结构

```text
fleet-snowfluff-for-chatgpt/
├── assets/                 # 壁纸、源精灵表和清晰化图集
├── scripts/                # 诊断、截图、状态测试和图集重排工具
├── src/
│   ├── injector.mjs        # DevTools 连接与热注入
│   ├── theme.css           # Light/Dark 背景与玻璃主题
│   ├── pet.js              # 桌宠状态机与交互
│   └── pet.css             # 桌宠界面样式
├── start.command           # macOS 启动器
└── package.json
```

## 诊断

主题启动后可以运行：

```bash
npm run diagnose
npm run test:pet
npm run capture -- /private/tmp/fleet-snowfluff.png
```

测试单一桌宠状态：

```bash
node scripts/test-pet-events.mjs 3000 waiting
```

## 常见问题

### 提示 ChatGPT 已经运行

关闭窗口不等于退出应用。请按 **Cmd+Q**，然后重新运行 `start.command`。

### 重启后主题消失

这是预期行为。主题不会修改官方应用，必须通过 `start.command` 启动主题会话。普通方式启动 ChatGPT 会显示官方界面。

### 桌宠或部分玻璃区域消失

先完全退出 ChatGPT 并重新运行启动器。如果问题发生在 ChatGPT 更新后，请附上应用版本、Light/Dark 模式和截图提交 Issue。

### 端口被占用

```bash
CHATGPT_THEME_PORT=9230 ./start.command
```

## 安全说明

Electron 调试端口只应绑定在本机。不要修改为公网地址，也不要在不受信任的网络环境中转发该端口。主题会话结束后请退出应用和注入器。

## 致谢与许可

设计思路与素材组织参考了 [`hachimi-ai/dsh-aemeath`](https://github.com/hachimi-ai/dsh-aemeath)。该项目面向 DeepSeek Harness；本仓库针对 ChatGPT Desktop 的实际限制重新实现了运行时注入和状态检测。

项目代码采用 [MIT License](LICENSE)。壁纸、角色和精灵素材不包含在 MIT 授权中，详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
