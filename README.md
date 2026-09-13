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

Render Web Service 使用此仓库 main 分支；Build Command 为 `npm ci`，Start Command 为 `npm run server`，Free 实例。环境变量 `NODE_VERSION=24.14.0`、`FRONTEND_ORIGIN=https://protossprobe.github.io,https://probe.earth,https://www.probe.earth`。健康检查 `/health`，端口自动使用 Render 的 PORT。也可使用 render.yaml Blueprint。

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

血量初始 20，月份无上限，净得分仅展示双方血量差，不再据此判胜。全善／全恶直接结束游戏，不触发善恶决战（优先于血量归零）。上个月双方 Boss 对决，本月为血月；血月 Boss 对决勇者先回复 5 血、魔王扣除 5 血，双方存活才互换一次血量。

任一方血量 ≤ 0 且没有阵营胜利时，进入金色环境「ARMAGEDDON · 善恶决战」。先保留触发回合的亮牌和结算；双方点击“收回手牌，开始善恶决战”后进入下个月，当前归属的全部牌回到各自手中（保留已有善恶转换与归属）。决战中冻结血量、善恶转换、卡牌归属与血月交换：双方 Boss 相遇，原血量 ≤ 0 的一方获胜；任一 Boss 对市民，原血量 > 0 的一方获胜；市民对市民仅弃牌并继续下一回合。规则矩阵同步切换为决战规则。交换阵营／重新开局会清除决战状态。

发布地址：https://probe.earth/hero-demon-game/
后端：https://hero-demon-game.onrender.com

双方手牌栏显示完整牌库的善/恶计数（含战场与弃牌），按转换后的类型与归属实时更新。在线卡牌采用 hero-0…hero-4 / demon-0…demon-4 的稳定编号；隐藏牌仍使用临时占位编号，避免暴露身份。

在线房间提供“交换阵营”：双方同意后原房间保留，交换席位并重置为第 1 月、20 血和初始牌库。只一方申请不会中断游戏；支持游戏中和胜负窗口操作。重连凭证跟随玩家，交换后刷新仍恢复正确阵营。game:action 新增 SWAP_SIDES，room:state 包含 swapReady。
