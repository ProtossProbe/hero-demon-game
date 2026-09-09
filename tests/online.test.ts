import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/index.ts';
import type { Reply, RoomView, RoomAction } from '../lib/game/protocol.ts';

test('two players: hidden staging, automatic resolution, joint next, thumbnails and resume', async () => {
  const server = createGameServer();
  await new Promise<void>((r) => server.http.listen(0, '127.0.0.1', r));
  const port = (server.http.address() as { port: number }).port;
  const clients: Socket[] = [];
  async function connect() {
    const c = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(c);
    await new Promise<void>((r) => c.once('connect', () => r()));
    return c;
  }
  async function request(c: Socket, event: string, data: unknown) {
    return (await c.timeout(2000).emitWithAck(event, data)) as Reply;
  }
  function ok(reply: Reply) {
    if (!reply.ok) throw Error(reply.error);
    return reply;
  }
  async function action(c: Socket, v: RoomView, a: RoomAction) {
    return ok(
      await request(c, 'game:action', {
        gameId: v.gameId,
        month: v.state.month,
        turn: v.state.turn,
        action: a,
      }),
    ).view;
  }
  try {
    const h = await connect(),
      d = await connect(),
      third = await connect();
    let hv = ok(await request(h, 'room:create', { side: 'hero' })).view;
    const joined = ok(await request(d, 'room:join', { roomId: hv.roomId }));
    let dv = joined.view;
    assert.equal(
      (await request(third, 'room:join', { roomId: hv.roomId })).ok,
      false,
    );
    await action(h, hv, { type: 'READY' });
    dv = await action(d, dv, { type: 'READY' });
    const room = server.rooms.get(hv.roomId)!;
    // Fetch each server-projected view through a harmless draw-all command.
    hv = await action(h, { ...hv, gameId: dv.gameId }, { type: 'DRAW_ALL' });
    assert.equal(
      hv.state.cards.filter((c) => c.owner === 'demon').every((c) => c.hidden),
      true,
    );
    const hc = hv.state.cards.find(
      (c) => c.owner === 'hero' && c.role === 'GOOD',
    )!;
    const dc = dv.state.cards.find(
      (c) => c.owner === 'demon' && c.role === 'EVIL',
    )!;
    hv = await action(h, hv, { type: 'PLAY', side: 'hero', cardId: hc.id });
    dv = await action(d, dv, { type: 'PLAY', side: 'demon', cardId: dc.id });
    assert.equal(dv.state.battle.hero, 'hidden-battle');
    assert.equal(dv.state.revealed, false);
    hv = await action(h, hv, { type: 'WITHDRAW', side: 'hero' });
    assert.equal(hv.state.battle.hero, undefined);
    hv = await action(h, hv, { type: 'PLAY', side: 'hero', cardId: hc.id });
    hv = await action(h, hv, { type: 'LOCK', side: 'hero' });
    assert.equal(hv.state.revealed, false);
    dv = await action(d, dv, { type: 'LOCK', side: 'demon' });
    assert.equal(dv.state.phase, 'resolved');
    assert.equal(dv.state.cards.find((c) => c.id === hc.id)?.owner, 'demon');
    assert.equal(
      dv.state.cards.filter(
        (c) => c.zone === 'discard' && c.discardedTurn! < dv.state.turn,
      ).length,
      0,
    );
    hv = await action(h, hv, { type: 'NEXT' });
    assert.equal(hv.state.phase, 'resolved');
    assert.ok(hv.state.battle.hero);
    dv = await action(d, dv, { type: 'NEXT' });
    assert.equal(dv.state.turn, 2);
    assert.equal(dv.state.battle.hero, undefined);
    assert.equal(
      dv.state.cards.filter(
        (c) => c.zone === 'discard' && c.discardedTurn! < dv.state.turn,
      ).length,
      2,
    );
    assert.equal(dv.state.score, dv.state.hp.hero - dv.state.hp.demon);
    d.disconnect();
    const resumed = await connect();
    dv = ok(
      await request(resumed, 'room:resume', {
        roomId: dv.roomId,
        token: joined.token,
      }),
    ).view;
    assert.equal(dv.me, 'demon');
    assert.equal(dv.state.turn, 2);
    assert.equal(room.gameId, 1);
    assert.equal(
      (
        await request(third, 'room:resume', {
          roomId: dv.roomId,
          token: 'wrong',
        })
      ).ok,
      false,
    );
  } finally {
    clients.forEach((c) => c.disconnect());
    server.close();
  }
});
