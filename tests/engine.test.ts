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
  type Environment,
  nextEnvironment,
  type Side,
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
  for (const r of rules)
    assert.deepEqual(
      ruleFor(r.roles[1], r.roles[0]),
      ruleFor(r.roles[0], r.roles[1]),
    );
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
test('environment cycle begins normal and follows normal bright blood normal', () => {
  let s = newGame();
  for (const environment of [
    'normal',
    'bright',
    'blood',
    'normal',
  ] as Environment[]) {
    assert.equal(s.environment, environment);
    s = lockBoth(duel('HERO', 'DEMON', s));
    assert.equal(s.history[0].environment, environment);
    s = transition(s, { type: 'NEXT' });
  }
});
for (const environment of ['normal', 'bright', 'blood'] as Environment[]) {
  for (const [hr, dr] of [
    ['HERO', 'DEMON'],
    ['HERO', 'GOOD'],
    ['HERO', 'EVIL'],
    ['GOOD', 'DEMON'],
    ['EVIL', 'DEMON'],
  ] as [Role, Role][]) {
    test(`month boundary ${environment}: ${hr} vs ${dr}`, () => {
      let s = newGame();
      s.environment = environment;
      s = lockBoth(duel(hr, dr, s));
      if (s.phase === 'targeting')
        s = transition(s, { type: 'TARGET', cardId: targets(s)[0].id });
      assert.equal(s.environment, environment);
      s = transition(s, { type: 'NEXT' });
      const expected =
        environment === 'bright'
          ? 'blood'
          : environment === 'blood'
            ? 'normal'
            : hr === 'HERO' && (dr === 'DEMON' || dr === 'GOOD')
              ? 'bright'
              : 'normal';
      assert.equal(s.environment, expected);
    });
  }
  for (const [hr, dr, normalHp, brightHp, bloodHp] of [
    ['HERO', 'DEMON', [20, 15], [25, 15], [20, 20]],
    ['HERO', 'EVIL', [17, 20], [20, 20], [14, 20]],
    ['EVIL', 'EVIL', [18, 20], [20, 20], [16, 20]],
    ['GOOD', 'GOOD', [21, 20], [21, 20], [21, 20]],
    ['GOOD', 'EVIL', [20, 20], [20, 20], [20, 20]],
    ['EVIL', 'GOOD', [20, 20], [20, 20], [20, 20]],
    ['GOOD', 'DEMON', [20, 21], [20, 21], [20, 21]],
    ['EVIL', 'DEMON', [20, 21], [20, 21], [20, 21]],
    ['HERO', 'GOOD', [20, 20], [20, 20], [20, 20]],
  ] as [Role, Role, number[], number[], number[]][]) {
    test(`0.12 ${environment} ${hr}/${dr}: hp and transformation`, () => {
      let s = newGame();
      s.environment = environment;
      s = lockBoth(duel(hr, dr, s));
      const hp =
        environment === 'normal'
          ? normalHp
          : environment === 'bright'
            ? brightHp
            : bloodHp;
      assert.deepEqual(s.hp, { hero: hp[0], demon: hp[1] });
      if (dr === 'EVIL' && (hr === 'HERO' || hr === 'EVIL'))
        assert.equal(
          s.cards.find((c) => c.id === s.battle.demon)!.role,
          environment === 'blood' ? 'EVIL' : 'GOOD',
        );
      if (hr === 'EVIL' && dr === 'EVIL')
        assert.equal(
          s.cards.find((c) => c.id === s.battle.hero)!.role,
          environment === 'blood' ? 'EVIL' : 'GOOD',
        );
      if (hr === 'GOOD' && dr === 'DEMON')
        assert.equal(s.cards.find((c) => c.id === s.battle.hero)!.role, 'EVIL');
      if ((hr === 'GOOD' && dr === 'EVIL') || (hr === 'EVIL' && dr === 'GOOD'))
        assert.equal(
          s.cards.find((c) => c.id === s.battle.hero)!.owner,
          'demon',
        );
      const rule = ruleFor(hr, dr, environment);
      assert.equal(s.last!.value, rule.value);
      assert.equal(s.score, s.hp.hero - s.hp.demon);
      assert.deepEqual(ruleFor(dr, hr, environment), rule);
      if (s.phase === 'resolved' && !s.monthEnded) {
        s = transition(s, { type: 'NEXT' });
        assert.equal(s.environment, environment);
      }
    });
  }
}
test('blood boss duel only exchanges asymmetric hp, no damage or healing', () => {
  let s = newGame();
  s.environment = 'blood';
  s.hp = { hero: 7, demon: 2 };
  s = lockBoth(duel('HERO', 'DEMON', s));
  assert.deepEqual(s.hp, { hero: 2, demon: 7 });
  assert.equal(s.armageddon, null);
  assert.equal(s.last!.swapCount, 1);
});
for (const hp of [5, 4])
  test(`demon damage at ${hp} HP starts armageddon instead of swapping`, () => {
    let s = newGame();
    s.environment = 'bright';
    s.hp = { hero: 20, demon: hp };
    s = lockBoth(duel('HERO', 'DEMON', s));
    assert.deepEqual(s.hp, { hero: 25, demon: hp - 5 });
    assert.equal(s.winner, null);
    assert.equal(s.armageddon, 'demon');
    assert.equal(s.armageddonPending, true);
    assert.equal(s.last!.swapped, false);
    assert.equal(s.phase, 'resolved');
  });
test('bright moon absorbs health without swapping', () => {
  let s = newGame();
  s.environment = 'bright';
  s.hp = { hero: 20, demon: 6 };
  s = lockBoth(duel('HERO', 'DEMON', s));
  assert.deepEqual(s.hp, { hero: 25, demon: 1 });
  assert.equal(s.winner, null);
});
for (const hp of [3, 2])
  test(`all-good victory at hero ${hp} HP bypasses armageddon`, () => {
    let s = newGame();
    s.hp.hero = hp;
    s.cards.forEach((c) => {
      if (c.role === 'EVIL') c.role = 'GOOD';
    });
    s.cards.find((c) => c.id === 'demon-3')!.role = 'EVIL';
    s = lockBoth(duel('HERO', 'EVIL', s));
    assert.equal(s.winner, 'hero');
    assert.equal(s.winReason, 'good');
    assert.equal(s.armageddon, null);
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
test('month counter continues beyond twelve regardless of health difference', () => {
  for (const score of [-8, 0, 8]) {
    let s = newGame();
    s.month = 12;
    s.hp = { hero: 20 + score, demon: 20 };
    s.score = 999; // 旧缓存不得影响胜负。
    s = lockBoth(duel('HERO', 'GOOD', s));
    assert.equal(s.winner, null);
    s = transition(s, { type: 'NEXT' });
    assert.equal(s.month, 13);
    s.month = 100;
    s = transition(lockBoth(duel('HERO', 'GOOD', s)), { type: 'NEXT' });
    assert.equal(s.month, 101);
    assert.equal(s.winner, null);
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
test('100 random games preserve invariants over bounded simulations', () => {
  for (let i = 0; i < 100; i++) {
    let s: State = newGame();
    s.cards.forEach((c) => (c.zone = 'hand'));
    let n = 0;
    while (!s.winner && n < 200) {
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
      n++;
      if (!s.winner) s = transition(s, { type: 'NEXT' });
    }
  }
});

test('blood moon exchanges without month twelve victory', () => {
  let s = newGame();
  s.month = 12;
  s.environment = 'blood';
  s.hp = { hero: 20, demon: 15 };
  s.score = 5;
  s = lockBoth(duel('HERO', 'DEMON', s));
  assert.deepEqual(s.hp, { hero: 15, demon: 20 });
  assert.equal(s.score, -5);
  assert.equal(s.winner, null);
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

for (const challenger of ['hero', 'demon'] as Side[]) {
  for (const hp of [0, -1]) {
    for (const [hr, dr] of [
      ['HERO', 'DEMON'],
      ['HERO', 'GOOD'],
      ['HERO', 'EVIL'],
      ['GOOD', 'DEMON'],
      ['EVIL', 'DEMON'],
    ] as [Role, Role][]) {
      test(`armageddon ${challenger} at ${hp}: ${hr} vs ${dr}`, () => {
        let s = newGame();
        s.hp[challenger] = hp;
        s.armageddon = challenger;
        const before = structuredClone(s);
        s = lockBoth(duel(hr, dr, s));
        assert.equal(
          s.winner,
          hr === 'HERO' && dr === 'DEMON'
            ? challenger
            : challenger === 'hero'
              ? 'demon'
              : 'hero',
        );
        assert.equal(s.winReason, 'armageddon');
        assert.equal(s.phase, 'finished');
        assert.deepEqual(s.hp, before.hp);
        assert.deepEqual(
          s.cards.map((c) => [c.id, c.role, c.owner]),
          before.cards.map((c) => [c.id, c.role, c.owner]),
        );
        assert.equal(s.last!.value, 0);
        assert.equal(s.last!.swapped, false);
      });
    }
  }
}
for (const [hr, dr] of [
  ['GOOD', 'GOOD'],
  ['GOOD', 'EVIL'],
  ['EVIL', 'GOOD'],
  ['EVIL', 'EVIL'],
] as [Role, Role][]) {
  test(`armageddon citizen effects frozen: ${hr} vs ${dr}`, () => {
    let s = newGame();
    s.hp.hero = -1;
    s.armageddon = 'hero';
    const before = structuredClone(s);
    s = lockBoth(duel(hr, dr, s));
    assert.equal(s.winner, null);
    assert.equal(s.monthEnded, false);
    assert.deepEqual(s.hp, before.hp);
    assert.deepEqual(
      s.cards.map((c) => [c.role, c.owner]),
      before.cards.map((c) => [c.role, c.owner]),
    );
    s = transition(s, { type: 'NEXT' });
    assert.equal(s.turn, 2);
    assert.equal(s.armageddon, 'hero');
    assert.equal(s.cards.filter((c) => c.zone === 'discard').length, 2);
  });
}
test('entering armageddon restores all cards to current owners after confirmation', () => {
  let s = lockBoth(duel('GOOD', 'EVIL'));
  s = transition(s, { type: 'NEXT' });
  s.hp.hero = 2;
  s = lockBoth(duel('EVIL', 'EVIL', s));
  assert.equal(s.armageddon, 'hero');
  assert.equal(s.hp.hero, 0);
  assert.equal(s.winner, null);
  assert.equal(s.phase, 'resolved');
  assert.equal(s.armageddonPending, true);
  const ownership = s.cards.map((c) => [c.id, c.role, c.owner]).sort();
  s = transition(s, { type: 'NEXT' });
  assert.equal(s.armageddonPending, false);
  assert.equal(s.armageddon, 'hero');
  assert.equal(s.environment, 'normal');
  assert.equal(s.turn, 1);
  assert.deepEqual(s.battle, {});
  assert.deepEqual(s.locked, { hero: false, demon: false });
  assert.ok(
    s.cards.every((c) => c.zone === 'hand' && c.discardedTurn === undefined),
  );
  assert.deepEqual(
    s.cards.map((c) => [c.id, c.role, c.owner]).sort(),
    ownership,
  );
});
test('all-evil victory bypasses armageddon even with nonpositive health', () => {
  let s = newGame();
  s.hp.hero = 0;
  s.cards.forEach((c) => {
    if (c.role === 'GOOD') c.role = 'EVIL';
  });
  s = lockBoth(duel('EVIL', 'DEMON', s));
  assert.equal(s.winner, 'demon');
  assert.equal(s.winReason, 'evil');
  assert.equal(s.armageddon, null);
});

test('triggering armageddon preserves blood label in historical log', () => {
  let s = newGame();
  s.environment = 'blood';
  s.hp.hero = 4;
  s = lockBoth(duel('EVIL', 'EVIL', s));
  assert.equal(s.armageddon, 'hero');
  assert.equal(s.history[0].environment, 'blood');
  s = transition(s, { type: 'NEXT' });
  s = lockBoth(duel('GOOD', 'EVIL', s));
  assert.equal(s.history[0].environment, 'armageddon');
  assert.equal(s.history[1].environment, 'blood');
});
test('blood moon blocked conversion cannot award all-good victory', () => {
  let s = newGame();
  s.environment = 'blood';
  s.cards.forEach((c) => {
    if (c.role === 'EVIL') c.role = 'GOOD';
  });
  s.cards.find((c) => c.id === 'demon-3')!.role = 'EVIL';
  s = lockBoth(duel('HERO', 'EVIL', s));
  assert.equal(s.winner, null);
  assert.equal(s.cards.find((c) => c.id === 'demon-3')!.role, 'EVIL');
});
