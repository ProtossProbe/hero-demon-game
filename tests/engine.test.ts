import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  transition,
  rules,
  ruleFor,
  targets,
  randomCard,
  citizenCounts,
  type State,
  type Role,
} from '../lib/game/engine.ts';
function lockBoth(s: State) {
  return transition(transition(s, { type: 'LOCK', side: 'hero' }), {
    type: 'LOCK',
    side: 'demon',
  });
}
function duel(h: Role, d: Role, initial = newGame()) {
  const s = structuredClone(initial);
  const hc = s.cards.find((c) => c.owner === 'hero' && c.role === h)!;
  const dc = s.cards.find((c) => c.owner === 'demon' && c.role === d)!;
  hc.zone = dc.zone = 'hand';
  return transition(
    transition(s, { type: 'PLAY', side: 'hero', cardId: hc.id }),
    { type: 'PLAY', side: 'demon', cardId: dc.id },
  );
}
for (const [h, d, v, hp, dp] of [
  ['EVIL', 'GOOD', 0, 20, 20],
  ['HERO', 'EVIL', -3, 17, 20],
  ['GOOD', 'DEMON', -1, 20, 21],
  ['HERO', 'DEMON', 5, 20, 15],
  ['HERO', 'GOOD', 0, 20, 20],
  ['GOOD', 'GOOD', 1, 21, 20],
  ['EVIL', 'DEMON', -1, 20, 21],
  ['EVIL', 'EVIL', -2, 18, 20],
] as [Role, Role, number, number, number][]) {
  test(`${h} vs ${d}: score, health, reveal`, () => {
    const before = duel(h, d);
    assert.equal(before.score, 0);
    assert.equal(before.revealed, false);
    const s = lockBoth(before);
    assert.equal(s.score, v);
    assert.deepEqual(s.hp, { hero: hp, demon: dp });
    assert.equal(s.revealed, true);
    assert.throws(() => lockBoth(s));
  });
}
test('all rules are symmetrical queries', () => {
  assert.equal(rules.length, 8);
  for (const r of rules) assert.equal(ruleFor(r.roles[1], r.roles[0]), r);
});
test('physical cards exchange owners and stay discarded', () => {
  const a = duel('EVIL', 'GOOD');
  const hid = a.battle.hero!,
    did = a.battle.demon!;
  const s = lockBoth(a);
  assert.equal(s.cards.find((c) => c.id === hid)!.owner, 'demon');
  assert.equal(s.cards.find((c) => c.id === did)!.owner, 'hero');
  assert.equal(s.cards.find((c) => c.id === hid)!.zone, 'discard');
  assert.equal(s.cards.filter((c) => c.owner === 'hero').length, 5);
});
test('conversion persists across months', () => {
  let s = lockBoth(duel('HERO', 'EVIL'));
  const id = s.battle.demon!;
  s = transition(s, { type: 'NEXT' });
  assert.equal(s.month, 2);
  assert.equal(s.cards.find((c) => c.id === id)!.role, 'GOOD');
  assert.equal(
    s.cards.every((c) => c.zone === 'hand'),
    true,
  );
});
test('blood moon starts next month and always swaps exactly once after damage', () => {
  let s = newGame();
  s.hp = { hero: 30, demon: 40 };
  for (let i = 1; i <= 4; i++) {
    assert.equal(s.bloodMoon, i > 1);
    const before = { ...s.hp };
    s = lockBoth(duel('HERO', 'DEMON', s));
    assert.deepEqual(
      s.hp,
      i === 1
        ? { hero: before.hero, demon: before.demon - 5 }
        : { hero: before.demon - 5, demon: before.hero },
    );
    assert.equal(s.last!.swapCount, i === 1 ? 0 : 1);
    assert.equal(s.score, s.hp.hero - s.hp.demon);
    if (i < 4) s = transition(s, { type: 'NEXT' });
  }
});
test('blood moon lasts whole month and expires after a non-duel month', () => {
  let s = transition(lockBoth(duel('HERO', 'DEMON')), { type: 'NEXT' });
  s = lockBoth(duel('GOOD', 'GOOD', s));
  assert.equal(s.bloodMoon, true);
  assert.equal(s.last!.swapped, false);
  s = transition(s, { type: 'NEXT' });
  assert.equal(s.bloodMoon, true);
  s = lockBoth(duel('HERO', 'GOOD', s));
  assert.equal(s.bloodMoon, true);
  s = transition(s, { type: 'NEXT' });
  assert.equal(s.bloodMoon, false);
});
for (const hp of [5, 4])
  test(`lethal demon damage at ${hp} HP skips blood moon swap`, () => {
    let s = newGame();
    s.bloodMoon = true;
    s.hp = { hero: 20, demon: hp };
    s = lockBoth(duel('HERO', 'DEMON', s));
    assert.deepEqual(s.hp, { hero: 20, demon: hp - 5 });
    assert.equal(s.winner, 'hero');
    assert.equal(s.winReason, 'health');
    assert.equal(s.last!.swapped, false);
    assert.equal(s.phase, 'finished');
  });
test('blood moon nonlethal demon damage happens before swap', () => {
  let s = newGame();
  s.bloodMoon = true;
  s.hp = { hero: 20, demon: 6 };
  s = lockBoth(duel('HERO', 'DEMON', s));
  assert.deepEqual(s.hp, { hero: 1, demon: 20 });
  assert.equal(s.winner, null);
});
for (const hp of [3, 2])
  test(`hero at ${hp} HP dies before all-good victory`, () => {
    let s = newGame();
    s.hp.hero = hp;
    s.cards.forEach((c) => {
      if (c.role === 'EVIL') c.role = 'GOOD';
    });
    s.cards.find((c) => c.id === 'demon-3')!.role = 'EVIL';
    s = lockBoth(duel('HERO', 'EVIL', s));
    assert.equal(s.winner, 'demon');
    assert.equal(s.winReason, 'health');
    assert.equal(s.hp.hero, hp - 3);
  });
test('good victory counts citizens in every zone', () => {
  let s = newGame();
  s.cards.forEach((c) => {
    if (c.role === 'EVIL') c.role = 'GOOD';
  });
  s = lockBoth(duel('GOOD', 'GOOD', s));
  assert.equal(s.winner, 'hero');
});
test('demon can choose last good on either side for immediate victory', () => {
  let s = newGame();
  s.cards.forEach((c) => {
    if (c.role === 'GOOD') c.role = 'EVIL';
  });
  s.cards.find((c) => c.id === 'demon-1')!.role = 'GOOD';
  s = lockBoth(duel('EVIL', 'DEMON', s));
  assert.equal(s.phase, 'targeting');
  assert.throws(() => transition(s, { type: 'TARGET', cardId: 'hero-0' }));
  s = transition(s, { type: 'TARGET', cardId: 'demon-1' });
  assert.equal(s.winner, 'demon');
});
test('no good target skips targeting and wins for demon', () => {
  let s = newGame();
  s.cards.forEach((c) => {
    if (c.role === 'GOOD') c.role = 'EVIL';
  });
  s = lockBoth(duel('EVIL', 'DEMON', s));
  assert.equal(s.winner, 'demon');
});
test('month 12 ends game by net score including tie', () => {
  for (const score of [-8, 0, 8]) {
    let s = newGame();
    s.month = 12;
    s.hp = { hero: 20 + score, demon: 20 };
    s.score = 999; // 旧缓存不得影响胜负。
    s = lockBoth(duel('HERO', 'GOOD', s));
    assert.equal(s.winner, score < 0 ? 'demon' : score > 0 ? 'hero' : 'draw');
    assert.throws(() => transition(s, { type: 'NEXT' }));
  }
});
test('invalid commands cannot mutate input', () => {
  const s = newGame();
  const copy = structuredClone(s);
  assert.throws(() => lockBoth(s));
  assert.throws(() =>
    transition(s, { type: 'PLAY', side: 'hero', cardId: 'demon-0' }),
  );
  assert.deepEqual(s, copy);
});
test('100 complete random games preserve cards, bosses, hand limits and terminate', () => {
  for (let i = 0; i < 100; i++) {
    let s: State = newGame();
    s.cards.forEach((c) => (c.zone = 'hand'));
    let n = 0;
    while (!s.winner) {
      for (const side of ['hero', 'demon'] as const) {
        const c = randomCard(s, side)!;
        s = transition(s, { type: 'PLAY', side, cardId: c.id });
      }
      s = lockBoth(s);
      if (s.phase === 'targeting')
        s = transition(s, { type: 'TARGET', cardId: targets(s)[0].id });
      assert.equal(s.score, s.hp.hero - s.hp.demon);
      assert.equal(s.cards.length, 10);
      assert.equal(new Set(s.cards.map((c) => c.id)).size, 10);
      for (const side of ['hero', 'demon'] as const)
        assert.equal(s.cards.filter((c) => c.owner === side).length, 5);
      assert.equal(s.cards.find((c) => c.role === 'HERO')!.owner, 'hero');
      assert.equal(s.cards.find((c) => c.role === 'DEMON')!.owner, 'demon');
      assert.ok(s.turn <= 5);
      assert.ok(++n <= 60);
      if (!s.winner) s = transition(s, { type: 'NEXT' });
    }
  }
});

test('second boss duel reverses post-damage score and month 12 winner', () => {
  let s = newGame();
  s.month = 12;
  s.bloodMoon = true;
  s.hp = { hero: 20, demon: 15 };
  s.score = 5;
  s = lockBoth(duel('HERO', 'DEMON', s));
  assert.deepEqual(s.hp, { hero: 10, demon: 20 });
  assert.equal(s.score, -10);
  assert.equal(s.winner, 'demon');
});
test('targeting, target selection and next month all preserve health-difference score', () => {
  let s = newGame();
  s.hp = { hero: 4, demon: 2 };
  s.score = 100;
  s = lockBoth(duel('EVIL', 'DEMON', s));
  assert.equal(s.phase, 'targeting');
  assert.equal(s.score, 1);
  s = transition(s, { type: 'TARGET', cardId: targets(s)[0].id });
  assert.equal(s.score, 1);
  s = transition(s, { type: 'NEXT' });
  assert.equal(s.score, 1);
});
test('immediate victory takes priority over opposing health advantage', () => {
  let s = newGame();
  s.hp = { hero: 2, demon: 40 };
  s.cards.forEach((c) => {
    if (c.role === 'EVIL') c.role = 'GOOD';
  });
  s = lockBoth(duel('GOOD', 'GOOD', s));
  assert.equal(s.score, -37);
  assert.equal(s.winner, 'hero');
  assert.equal(s.phase, 'finished');
});

test('both sides can replace and withdraw staged cards before locking', () => {
  let s = duel('GOOD', 'EVIL');
  for (const side of ['hero', 'demon'] as const) {
    const previous = s.battle[side]!;
    const replacement = s.cards.find(
      (c) =>
        c.owner === side &&
        c.id !== previous &&
        (c.zone === 'hand' || c.zone === 'deck'),
    )!;
    if (replacement.zone === 'deck')
      s = transition(s, { type: 'DRAW', side, cardId: replacement.id });
    s = transition(s, { type: 'PLAY', side, cardId: replacement.id });
    assert.equal(s.cards.find((c) => c.id === previous)!.zone, 'hand');
    assert.equal(s.changes[side], 1);
    s = transition(s, { type: 'WITHDRAW', side });
    assert.equal(s.battle[side], undefined);
    assert.equal(s.changes[side], 2);
  }
  assert.equal(s.score, 0);
  assert.equal(s.revealed, false);
  assert.equal(s.cards.filter((c) => c.zone === 'discard').length, 0);
});
test('first lock does not reveal; second lock automatically settles once', () => {
  let s = duel('HERO', 'DEMON');
  s = transition(s, { type: 'LOCK', side: 'hero' });
  assert.equal(s.phase, 'playing');
  assert.equal(s.revealed, false);
  assert.equal(s.score, 0);
  assert.throws(() => transition(s, { type: 'WITHDRAW', side: 'hero' }));
  assert.throws(() => transition(s, { type: 'LOCK', side: 'hero' }));
  s = transition(s, { type: 'LOCK', side: 'demon' });
  assert.equal(s.revealed, true);
  assert.equal(s.score, 5);
  assert.equal(s.history.length, 1);
  assert.throws(() => transition(s, { type: 'LOCK', side: 'demon' }));
  s = transition(s, { type: 'NEXT' });
  assert.deepEqual(s.locked, { hero: false, demon: false });
  assert.deepEqual(s.changes, { hero: 0, demon: 0 });
});
test('opponent remains free to change after first side locks', () => {
  let s = duel('HERO', 'DEMON');
  s = transition(s, { type: 'LOCK', side: 'hero' });
  s = transition(s, { type: 'PLAY', side: 'demon', cardId: 'demon-1' });
  assert.equal(s.revealed, false);
  s = transition(s, { type: 'LOCK', side: 'demon' });
  assert.equal(s.score, 0);
  assert.equal(s.last!.roles[1], 'GOOD');
});
test('converted discards persist through next turn and are not playable', () => {
  let s = duel('EVIL', 'EVIL');
  const ids = [s.battle.hero, s.battle.demon];
  s = lockBoth(s);
  assert.equal(s.monthEnded, false);
  s = transition(s, { type: 'NEXT' });
  for (const id of ids) {
    const card = s.cards.find((c) => c.id === id)!;
    assert.equal(card.role, 'GOOD');
    assert.equal(card.zone, 'discard');
    assert.throws(() =>
      transition(s, { type: 'PLAY', side: card.owner, cardId: card.id }),
    );
  }
});

test('citizen counts track transformed discards and ownership across months', () => {
  let s = lockBoth(duel('GOOD', 'EVIL'));
  assert.deepEqual(citizenCounts(s), {
    hero: { good: 1, evil: 3 },
    demon: { good: 3, evil: 1 },
  });
  s = transition(s, { type: 'NEXT' });
  assert.deepEqual(citizenCounts(s), {
    hero: { good: 1, evil: 3 },
    demon: { good: 3, evil: 1 },
  });
  s = lockBoth(duel('HERO', 'EVIL', s));
  assert.deepEqual(citizenCounts(s), {
    hero: { good: 1, evil: 3 },
    demon: { good: 4, evil: 0 },
  });
});
