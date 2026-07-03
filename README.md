# 小晴与屿深的App

来自 Claude Design 原型（`project/` 目录）的真实实现。当前只实现了**首页**（聊天 / 日记 / 写信三个模式 + 侧边栏 + 底部导航），管理 / 日历 / 娱乐三个tab是占位页。

- `frontend/` — React + Vite 网页版，手机浏览器打开体验（可"添加到主屏幕"）
- `backend/` — Node + Express + SQLite，负责存日记/信件/聊天记录，并代理调用 Claude API 生成屿深的回复
- `project/` `chats/` — 原始 Claude Design 导出的设计稿和对话记录，仅作参考，不参与运行

## 本地跑起来

```bash
# 后端
cd backend
cp .env.example .env   # 填入你的 ANTHROPIC_API_KEY（不填的话聊天会用一句固定回复占位）
npm install
npm run dev             # 默认监听 3001 端口

# 前端（新开一个终端）
cd frontend
cp .env.example .env    # 默认指向 http://localhost:3001/api，本地不用改
npm install
npm run dev              # 默认监听 5173 端口，浏览器打开 http://localhost:5173
```

## 部署到你的 VPS

思路：后端跑成一个常驻服务（进程管理用 pm2 或 systemd 都行），前端打包成静态文件，用 nginx 一起对外提供，iPhone 上用 Safari 打开你的域名，然后"分享 → 添加到主屏幕"，就有了一个类 App 的图标。

### 1. 后端

```bash
cd backend
npm install --omit=dev
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_API_KEY（去 https://console.anthropic.com 申请）
```

用 pm2 常驻运行（`npm install -g pm2`）：

```bash
pm2 start src/index.js --name xq-backend
pm2 save
pm2 startup   # 按提示设置开机自启
```

SQLite 数据库文件会自动创建在 `backend/data.sqlite`，记得定期备份这个文件（比如 `cp` 到别处或者拉个 cron job）。

### 2. 前端

```bash
cd frontend
cp .env.example .env
# 编辑 .env，把 VITE_API_BASE_URL 改成后端的公网地址，例如 https://你的域名/api
npm install
npm run build   # 产物在 frontend/dist/
```

### 3. nginx 反代（示例）

```nginx
server {
  listen 443 ssl;
  server_name 你的域名;

  # ssl_certificate / ssl_certificate_key 用 certbot 申请

  location / {
    root /path/to/frontend/dist;
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
  }
}
```

HTTPS 是必须的——iOS Safari 的"添加到主屏幕"全屏模式、以及一些浏览器 API，在 http 下要么不工作要么会被警告拦截。用 `certbot --nginx` 免费申请证书即可。

### 4. iPhone 上使用

1. Safari 打开 `https://你的域名`
2. 点分享按钮 → 添加到主屏幕
3. 以后从主屏幕图标打开，就是全屏无浏览器地址栏的体验

## AI 接入设置（侧边栏）

打开侧边栏（左上角汉堡菜单）→「AI 接入设置」，不用改 VPS 上的文件、直接在 App 里管理屿深的回复方式，分两层：

**第一层 — 供应商列表**：可以添加任意多个 AI 供应商（比如官方 Anthropic、某个中转站、另一个中转站……），点哪个供应商就用哪个，右上角齿轮进编辑。下面单独有一个「Claude Code（VPS本地）」选项，跟供应商列表平级——选它的话回复走 VPS 上装好的 [Claude Code](https://code.claude.com) CLI（需要提前 `claude login` 用你的订阅账号登录），不用单独的 API Key。

**第二层 — 单个供应商编辑**：
- 供应商类型：`Anthropic 格式` 或 `OpenAI 兼容格式`（大部分中转站用的是 OpenAI 格式，选错了会连不上）
- 名称：随便起，方便自己认
- 是否启用多 Key 模式：开启后每次请求从你填的多个 Key 里随机挑一个用（分摊限流），关闭就一直用第一个
- API Key：单 Key 模式一个输入框，多 Key 模式一行一个
- API Base URL：中转站给你的接口地址；用官方 Anthropic 可以留空
- API 模型：一个供应商下可以加好几个模型名，点哪个当前就用哪个

每个供应商和 Claude Code 都有「测试连接」按钮，切换/保存后立即生效，不用重启后端。

## 说明 / 已知限制

- 只做了首页（聊天/日记/写信），管理、日历、娱乐三个tab是"敬请期待"占位页，原型里这几页的完整设计还在 `project/小晴与屿深的App.dc.html` 里，之后可以继续实现。
- 这是单人使用的个人项目，没有账号系统——写信功能里"寄给屿深/寄给小晴"只是标记信件的收件人，不是两个人各自登录。
- 数据都存在后端的 SQLite 文件里，没有做多设备实时同步（多个设备打开同一个后端地址，看到的是同一份数据，但不是 WebSocket 实时推送）。
- API Key 目前是明文存在 SQLite 里的（没有加密），这台 VPS 只有你自己能访问的话问题不大，但不要把 `data.sqlite` 文件分享给别人。
