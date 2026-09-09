# 勇者斗大魔王

React + TypeScript + Vite 前端，Node.js + Socket.IO 双人房间后端。共享规则引擎，支持本地随机电脑和在线双人。

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run server
# 另开终端
npm run dev
```

浏览器打开 http://localhost:5173 。选择“在线双人”，服务器地址填 http://localhost:3001 。两个独立浏览器窗口创建/加入同一个房间，双方准备开始。保持本地模式即可和电脑游玩。

```sh
npm test
npm run build
```

构建产生 dist/ ，以及可直接打开的 dist/勇者斗大魔王.html（本地人机无需后端）。

## 在线部署

Render Web Service 使用此仓库 main 分支；Build Command 为 `npm ci`，Start Command 为 `npm run server`，Free 实例。环境变量 `NODE_VERSION=24.14.0`、`FRONTEND_ORIGIN=https://protossprobe.github.io`。健康检查 `/health`，端口自动使用 Render 的 PORT。也可使用 render.yaml Blueprint。

GitHub Pages 来源设置为 GitHub Actions。仓库 Actions 变量 `SERVER_URL` 设置为 Render 的 HTTPS 服务地址。推送 main 或手动运行 Publish game 工作流，发布 dist。

前端只保存本人的重连凭证（sessionStorage）；服务器持有真实状态，只向玩家投影可见卡牌。未锁定可换牌/撤回；双方锁定自动亮牌结算；双方准备下一回合后才推进。缩略卡按结算后的归属和阵营显示，当前刚结算的两张牌继续大图显示，进入下一回合才成为缩略图。

免费测试服务没有数据库。服务器重启/重新部署会清空房间；双方离线 30 分钟后房间过期。短暂断线可在原标签刷新重连。离开房间会放弃本标签的席位凭证，需要另建房间继续。Render 免费服务空闲后休眠，首次连接需等待唤醒。

## 文件结构

- app/page.tsx：共享对战界面；app/game-app.tsx：本地/在线入口、房间与连接状态
- components/：卡牌、规则矩阵、月份提示、胜负窗口
- hooks/：本地电脑逻辑、手牌排序
- lib/game/engine.ts：规则、状态机、血量和净得分、永久转换
- lib/game/protocol.ts：客户端与服务端消息类型
- server/index.ts：房间、席位认证、隐藏状态投影、双方下一回合确认
- tests/：规则测试、实际 Socket.IO 双人测试
- .github/workflows/pages.yml：前端自动发布
- render.yaml：后端部署配置

## 通信事件

客户端发送 room:create、room:join、room:resume 和 game:action；服务器发送 room:state。动作包含 READY、DRAW_ALL、DRAW、PLAY、WITHDRAW、LOCK、TARGET、NEXT。每次动作携带 gameId/month/turn，过期操作被拒绝。双方下一回合和重开使用独立准备标记。GET /health 用于健康检查。

血量初始 20，可为负；净得分恒等于勇者血量减魔王血量。连续第 N 次 Boss 对决在伤害后交换 N−1 次。立即胜利优先于第 12 月血量比较。完整八项规则见页面可点击矩阵和独立引擎测试。
