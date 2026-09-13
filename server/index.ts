import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Server, type Socket } from 'socket.io';
import {
  newGame,
  citizenCounts,
  transition,
  targets,
  type Side,
  type State,
  type Command,
} from '../lib/game/engine.ts';
import type { RoomView, Reply } from '../lib/game/protocol.ts';

type Player = { token: string; socketId: string | null };
type Room = {
  id: string;
  players: Partial<Record<Side, Player>>;
  state: State;
  phase: RoomView['phase'];
  ready: Record<Side, boolean>;
  nextReady: Record<Side, boolean>;
  swapReady: Record<Side, boolean>;
  gameId: number;
  revision: number;
  touched: number;
};
const sides: Side[] = ['hero', 'demon'];
const flags = () => ({ hero: false, demon: false });

export function project(room: Room, me: Side): RoomView {
  const state = structuredClone(room.state);
  const other: Side = me === 'hero' ? 'demon' : 'hero';
  // Hidden cards receive synthetic IDs: actual role and stable card identity never leave the server.
  state.cards = state.cards.map((c, i) => {
    if (
      c.owner !== other ||
      c.zone === 'discard' ||
      (c.zone === 'battle' && state.revealed)
    )
      return c;
    const id = c.zone === 'battle' ? 'hidden-battle' : `hidden-${i}`;
    if (c.zone === 'battle') state.battle[other] = id;
    return { id, role: 'EVIL', owner: other, zone: c.zone, hidden: true };
  });
  return {
    roomId: room.id,
    me,
    gameId: room.gameId,
    revision: room.revision,
    phase: room.phase,
    connected: {
      hero: !!room.players.hero?.socketId,
      demon: !!room.players.demon?.socketId,
    },
    ready: { ...room.ready },
    nextReady: { ...room.nextReady },
    swapReady: { ...room.swapReady },
    state,
    citizenCounts: citizenCounts(room.state),
    targetOptions:
      me === 'demon' && room.state.phase === 'targeting'
        ? targets(room.state)
        : [],
  };
}

export function createGameServer(
  origins = process.env.FRONTEND_ORIGIN ??
    'http://127.0.0.1:5173,http://localhost:5173',
) {
  const allowed = new Set(
    origins
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'hero-demon', protocol: 4 }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  const io = new Server(http, {
    cors: { origin: [...allowed] },
    allowRequest: (req, cb) =>
      cb(null, !req.headers.origin || allowed.has(req.headers.origin)),
    maxHttpBufferSize: 8192,
  });
  const rooms = new Map<string, Room>();
  function publish(room: Room) {
    room.revision++;
    room.touched = Date.now();
    for (const side of sides) {
      const id = room.players[side]?.socketId;
      if (id) io.to(id).emit('room:state', project(room, side));
    }
  }
  function attach(socket: Socket, room: Room, side: Side) {
    socket.data.roomId = room.id;
    socket.data.side = side;
    room.players[side]!.socketId = socket.id;
  }
  function membership(socket: Socket) {
    const room = rooms.get(socket.data.roomId);
    const side = socket.data.side as Side;
    if (
      !room ||
      !sides.includes(side) ||
      room.players[side]?.socketId !== socket.id
    )
      throw new Error('请先创建或加入房间');
    return { room, side };
  }
  function startRound(room: Room) {
    room.state = newGame();
    room.state.cards.forEach((c) => {
      c.zone = 'hand';
    });
    room.phase = 'active';
    room.gameId++;
    room.ready = flags();
    room.nextReady = flags();
    room.swapReady = flags();
  }
  function requireBoth(room: Room) {
    if (!room.players.hero?.socketId || !room.players.demon?.socketId)
      throw new Error('等待双方在线后继续');
  }
  io.on('connection', (socket) => {
    let count = 0,
      windowStart = Date.now();
    const guard =
      (handler: (data: any) => Reply) =>
      (data: any, ack?: (reply: Reply) => void) => {
        try {
          if (Date.now() - windowStart > 10000) {
            count = 0;
            windowStart = Date.now();
          }
          if (++count > 100) throw new Error('操作过于频繁，请稍后再试');
          const result = handler(data);
          if (typeof ack === 'function') ack(result);
        } catch (e) {
          if (typeof ack === 'function')
            ack({
              ok: false,
              error: e instanceof Error ? e.message : '操作失败',
            });
        }
      };
    socket.on(
      'room:create',
      guard((data) => {
        if (socket.data.roomId) throw new Error('请先离开当前房间');
        if (rooms.size >= 200) throw new Error('测试服务器房间已满');
        const side: Side = data?.side === 'demon' ? 'demon' : 'hero';
        let id: string;
        do {
          id = randomBytes(3).toString('hex').toUpperCase();
        } while (rooms.has(id));
        const room: Room = {
          id,
          players: {},
          state: newGame(),
          phase: 'waiting',
          ready: flags(),
          nextReady: flags(),
          swapReady: flags(),
          gameId: 0,
          revision: 0,
          touched: Date.now(),
        };
        const token = randomBytes(24).toString('hex');
        room.players[side] = { token, socketId: socket.id };
        rooms.set(id, room);
        attach(socket, room, side);
        publish(room);
        return { ok: true, view: project(room, side), token };
      }),
    );
    socket.on(
      'room:join',
      guard((data) => {
        if (socket.data.roomId) throw new Error('请先离开当前房间');
        const id = String(data?.roomId ?? '')
          .trim()
          .toUpperCase();
        const room = rooms.get(id);
        if (!room) throw new Error('房间不存在或已过期，请重新创建');
        const side = sides.find((s) => !room.players[s]);
        if (!side) throw new Error('房间已满，刷新重连请使用原来的页面');
        const token = randomBytes(24).toString('hex');
        room.players[side] = { token, socketId: socket.id };
        attach(socket, room, side);
        publish(room);
        return { ok: true, view: project(room, side), token };
      }),
    );
    socket.on(
      'room:resume',
      guard((data) => {
        const room = rooms.get(String(data?.roomId ?? ''));
        if (!room) throw new Error('房间已过期或服务器已重启，请创建新房间');
        const token = String(data?.token ?? '');
        const side = sides.find((s) => {
          const saved = room.players[s]?.token;
          return (
            saved?.length === token.length &&
            timingSafeEqual(Buffer.from(saved), Buffer.from(token))
          );
        });
        if (!side) throw new Error('无法恢复这个玩家席位');
        const oldId = room.players[side]!.socketId;
        if (oldId && oldId !== socket.id)
          io.sockets.sockets.get(oldId)?.disconnect(true);
        attach(socket, room, side);
        publish(room);
        return { ok: true, view: project(room, side) };
      }),
    );
    socket.on(
      'game:action',
      guard((data) => {
        const { room, side } = membership(socket);
        requireBoth(room);
        if (
          data?.gameId !== room.gameId ||
          data?.month !== room.state.month ||
          data?.turn !== room.state.turn
        )
          throw new Error('回合已更新，请根据最新画面操作');
        const action = data?.action;
        if (!action || typeof action.type !== 'string')
          throw new Error('无效指令');
        if (action.type === 'SWAP_SIDES') {
          room.swapReady[side] = true;
          if (room.swapReady.hero && room.swapReady.demon) {
            [room.players.hero, room.players.demon] = [
              room.players.demon,
              room.players.hero,
            ];
            for (const newSide of sides) {
              const playerSocket = io.sockets.sockets.get(
                room.players[newSide]!.socketId!,
              );
              if (playerSocket) playerSocket.data.side = newSide;
            }
            startRound(room);
          }
        } else if (action.type === 'READY') {
          if (room.phase === 'active') throw new Error('游戏正在进行');
          room.ready[side] = true;
          if (room.ready.hero && room.ready.demon) startRound(room);
        } else {
          if (room.phase !== 'active') throw new Error('请等待双方准备');
          if (action.type === 'NEXT') {
            if (room.state.phase !== 'resolved')
              throw new Error('请先完成本回合结算');
            room.nextReady[side] = true;
            if (room.nextReady.hero && room.nextReady.demon) {
              room.state = transition(room.state, { type: 'NEXT' });
              room.nextReady = flags();
            }
          } else if (action.type === 'DRAW_ALL') {
            for (const c of room.state.cards.filter(
              (c) => c.owner === side && c.zone === 'deck',
            ))
              room.state = transition(room.state, {
                type: 'DRAW',
                side,
                cardId: c.id,
              });
          } else {
            if (
              !['PLAY', 'DRAW', 'WITHDRAW', 'LOCK', 'TARGET'].includes(
                action.type,
              )
            )
              throw new Error('无效指令');
            if (action.type === 'TARGET' && side !== 'demon')
              throw new Error('只有魔王可以指定腐化目标');
            if (
              ['PLAY', 'DRAW', 'TARGET'].includes(action.type) &&
              typeof action.cardId !== 'string'
            )
              throw new Error('缺少卡牌编号');
            // Side is determined by the authenticated seat, never by the client payload.
            room.state = transition(room.state, {
              type: action.type,
              side,
              cardId: action.cardId,
            } as Command);
            if (room.state.winner) room.phase = 'finished';
          }
        }
        publish(room);
        return { ok: true, view: project(room, socket.data.side as Side) };
      }),
    );
    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.roomId);
      const side = socket.data.side as Side;
      if (room && room.players[side]?.socketId === socket.id) {
        room.players[side]!.socketId = null;
        publish(room);
      }
    });
  });
  const sweep = setInterval(() => {
    for (const [id, room] of rooms)
      if (
        !room.players.hero?.socketId &&
        !room.players.demon?.socketId &&
        Date.now() - room.touched > 30 * 60 * 1000
      )
        rooms.delete(id);
  }, 60000);
  sweep.unref();
  return {
    http,
    io,
    rooms,
    close: () => {
      clearInterval(sweep);
      io.close();
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createGameServer();
  server.http.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () =>
    console.log('Game server listening'),
  );
}
