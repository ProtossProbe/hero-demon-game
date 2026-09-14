export type Role = 'HERO' | 'DEMON' | 'GOOD' | 'EVIL';
export const GAME_VERSION = '0.12';
export type Environment = 'normal' | 'bright' | 'blood';
export const environmentNames = {
  normal: '普通月',
  bright: '朗月',
  blood: '血月',
  armageddon: '善恶决战',
} as const;
export type Side = 'hero' | 'demon';
export type Card = {
  id: string;
  role: Role;
  owner: Side;
  zone: 'deck' | 'hand' | 'battle' | 'discard';
  hidden?: boolean;
  discardedTurn?: number;
};
export const names: Record<Role, string> = {
  HERO: '勇者',
  DEMON: '大魔王',
  GOOD: '善良市民',
  EVIL: '邪恶市民',
};
export const rules = [
  {
    roles: ['EVIL', 'GOOD'],
    value: 0,
    effect: '两张市民牌交换归属，进入新持有者的弃牌堆。',
  },
  {
    roles: ['HERO', 'EVIL'],
    value: -3,
    effect: '勇者受到 3 点伤害；出战的邪恶市民转化为善良市民。',
  },
  {
    roles: ['DEMON', 'GOOD'],
    value: -1,
    effect: '魔王回复 1 点血量；出战的善良市民转化为邪恶市民。',
  },
  {
    roles: ['HERO', 'DEMON'],
    value: 5,
    effect: '魔王受到 5 点伤害；本月结束，下个月为朗月。',
  },
  {
    roles: ['HERO', 'GOOD'],
    value: 0,
    effect: '无血量或市民变化；本月结束，下个月为朗月。',
  },
  { roles: ['GOOD', 'GOOD'], value: 1, effect: '勇者回复 1 点血量。' },
  {
    roles: ['DEMON', 'EVIL'],
    value: -1,
    effect:
      '魔王回复 1 点血量，并指定双方牌库中任意一名善良市民腐化；没有目标则跳过。',
  },
  {
    roles: ['EVIL', 'EVIL'],
    value: -2,
    effect: '勇者受到 2 点伤害；出战的两名邪恶市民均转化为善良市民。',
  },
] as const;
export function ruleFor(a: Role, b: Role, environment: Environment = 'normal') {
  const rule = rules.find(
    (r) =>
      (r.roles[0] === a && r.roles[1] === b) ||
      (r.roles[0] === b && r.roles[1] === a),
  );
  if (!rule) throw new Error('无效的角色组合');
  const has = (role: Role) => a === role || b === role;
  const duel = has('HERO') && has('DEMON');
  const heroEvil = has('HERO') && has('EVIL');
  const evilPair = a === 'EVIL' && b === 'EVIL';
  let heroDelta = heroEvil
    ? -3
    : evilPair
      ? -2
      : a === 'GOOD' && b === 'GOOD'
        ? 1
        : 0;
  let demonDelta = duel
    ? -5
    : has('DEMON') && (has('GOOD') || has('EVIL'))
      ? 1
      : 0;
  let effect: string = rule.effect;
  if (environment === 'bright') {
    if (duel) {
      heroDelta = 5;
      effect =
        '朗月吸血：勇者回复 5 血、魔王扣除 5 血，不互换血量；下个月为血月。';
    }
    if (heroEvil) {
      heroDelta = 0;
      effect = '朗月守护：勇者不掉血；出战的邪恶市民转化为善良市民。';
    }
    if (evilPair) {
      heroDelta = 0;
      effect = '朗月守护：勇者不掉血；出战的两名邪恶市民均转化为善良市民。';
    }
    if (has('HERO') && has('GOOD'))
      effect = '无血量或市民变化；本月结束，下个月为血月。';
  }
  if (environment === 'blood') {
    if (duel) {
      demonDelta = 0;
      effect = '血月：不造成伤害、不回血，直接互换双方血量；下个月为普通月。';
    }
    if (heroEvil) {
      heroDelta = -6;
      effect = '血月：勇者受到 6 点伤害；邪恶市民不转化为善良。';
    }
    if (evilPair) {
      heroDelta = -4;
      effect = '血月：勇者受到 4 点伤害；两名邪恶市民保持邪恶。';
    }
    if (has('HERO') && has('GOOD'))
      effect = '无血量或市民变化；本月结束，下个月为普通月。';
  }
  return {
    ...rule,
    value: heroDelta - demonDelta,
    effect,
    heroDelta,
    demonDelta,
    convertEvil: environment !== 'blood',
    swapHealth: environment === 'blood' && duel,
  };
}
export function nextEnvironment(
  environment: Environment,
  roles: Role[],
): Environment {
  if (environment === 'bright') return 'blood';
  if (environment === 'blood') return 'normal';
  return roles.includes('HERO') &&
    (roles.includes('DEMON') || roles.includes('GOOD'))
    ? 'bright'
    : 'normal';
}
export type State = {
  cards: Card[];
  month: number;
  turn: number;
  hp: Record<Side, number>;
  /** 派生值：始终等于勇者血量减魔王血量。 */
  score: number;
  environment: Environment;
  /** 血量归零后，需要抓到对方 Boss 的阵营。 */
  armageddon: Side | null;
  armageddonPending: boolean;
  phase: 'playing' | 'targeting' | 'resolved' | 'finished';
  revealed: boolean;
  monthEnded: boolean;
  winner: Side | 'draw' | null;
  winReason?: 'good' | 'evil' | 'armageddon';
  battle: Partial<Record<Side, string>>;
  locked: Record<Side, boolean>;
  changes: Record<Side, number>;
  last: null | {
    environment: Environment | 'armageddon';
    roles: Role[];
    value: number;
    effects: string[];
    swapped: boolean;
    swapCount: number;
  };
  history: { environment: Environment | 'armageddon'; text: string }[];
};
export type Command =
  | { type: 'DRAW' | 'PLAY'; side: Side; cardId: string }
  | { type: 'LOCK' | 'WITHDRAW'; side: Side }
  | { type: 'TARGET'; cardId: string }
  | { type: 'NEXT' };
export function newGame(): State {
  return {
    cards: (['hero', 'demon'] as Side[]).flatMap((side) =>
      (
        [
          side === 'hero' ? 'HERO' : 'DEMON',
          'GOOD',
          'GOOD',
          'EVIL',
          'EVIL',
        ] as Role[]
      ).map((role, i) => ({
        id: `${side}-${i}`,
        role,
        owner: side,
        zone: side === 'hero' ? 'deck' : 'hand',
      })),
    ),
    month: 1,
    turn: 1,
    hp: { hero: 20, demon: 20 },
    score: 0,
    environment: 'normal',
    armageddon: null,
    armageddonPending: false,
    phase: 'playing',
    revealed: false,
    monthEnded: false,
    winner: null,
    battle: {},
    locked: { hero: false, demon: false },
    changes: { hero: 0, demon: 0 },
    last: null,
    history: [],
  };
}
const boss = (r: Role) => r === 'HERO' || r === 'DEMON';
export function targets(s: State) {
  return s.cards.filter((c) => !c.hidden && c.role === 'GOOD');
}
export function netScore(s: Pick<State, 'hp'>): number {
  return s.hp.hero - s.hp.demon;
}
function finish(s: State) {
  s.score = netScore(s);
  const citizens = s.cards.filter((c) => !boss(c.role));
  if (!s.armageddon && citizens.every((c) => c.role === 'GOOD')) {
    s.winner = 'hero';
    s.winReason = 'good';
  }
  if (!s.armageddon && citizens.every((c) => c.role === 'EVIL')) {
    s.winner = 'demon';
    s.winReason = 'evil';
  }
  if (!s.winner && !s.armageddon && (s.hp.hero <= 0 || s.hp.demon <= 0)) {
    s.armageddon = s.hp.hero <= 0 ? 'hero' : 'demon';
    s.armageddonPending = true;
    s.monthEnded = true;
    s.last!.effects.push(
      `善恶决战：${s.armageddon === 'hero' ? '勇者' : '魔王'}血量归零。双方确认后收回各自牌库的全部牌，开始决战；Boss 相遇则该方胜，Boss 对市民则另一方胜。`,
    );
  }
  s.phase = s.winner ? 'finished' : 'resolved';
  s.history.unshift({
    environment: s.last!.environment,
    text: `第 ${s.month} 月 · 回合 ${s.turn}：${s.last!.roles.map((r) => names[r]).join(' vs ')}，${s.last!.value > 0 ? '+' : ''}${s.last!.value}；${s.last!.effects.join(' ')}`,
  });
}
export function transition(input: State, command: Command): State {
  const s = structuredClone(input);
  s.score = netScore(s);
  if (s.phase === 'finished') throw new Error('游戏已结束');
  if (command.type === 'DRAW' || command.type === 'PLAY') {
    if (s.phase !== 'playing') throw new Error('请先完成本回合结算');
    const c = s.cards.find(
      (c) => c.id === command.cardId && c.owner === command.side,
    );
    if (!c) throw new Error('这不是你的牌');
    if (command.type === 'DRAW') {
      if (c.zone !== 'deck') throw new Error('只能从牌库加入手牌');
      c.zone = 'hand';
    } else {
      if (c.zone !== 'hand' || s.locked[command.side])
        throw new Error('已锁定或卡牌不在手牌区');
      const previous = s.cards.find(
        (card) => card.id === s.battle[command.side],
      );
      if (previous) {
        previous.zone = 'hand';
        s.changes[command.side]++;
      }
      c.zone = 'battle';
      s.battle[command.side] = c.id;
    }
    return s;
  }
  if (command.type === 'WITHDRAW') {
    if (s.phase !== 'playing' || s.locked[command.side])
      throw new Error('锁定后不能撤回');
    const card = s.cards.find((c) => c.id === s.battle[command.side]);
    if (!card) throw new Error('出牌区没有卡牌');
    card.zone = 'hand';
    delete s.battle[command.side];
    s.changes[command.side]++;
    return s;
  }
  if (command.type === 'TARGET') {
    if (s.phase !== 'targeting') throw new Error('当前无需指定目标');
    const c = targets(s).find((c) => c.id === command.cardId);
    if (!c) throw new Error('请选择善良市民');
    c.role = 'EVIL';
    s.last!.effects.push(
      `${c.owner === 'hero' ? '勇者方' : '魔王方'}的 ${c.id} 已腐化。`,
    );
    finish(s);
    return s;
  }
  if (command.type === 'NEXT') {
    if (s.phase !== 'resolved') throw new Error('请先亮牌并完成结算');
    if (s.monthEnded) {
      s.environment = s.armageddon
        ? 'normal'
        : nextEnvironment(s.environment, s.last!.roles);
      s.armageddonPending = false;
      s.month++;
      s.turn = 1;
      // 洗牌只改变顺序，身份、归属和转换永久保留。
      for (let i = s.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.cards[i], s.cards[j]] = [s.cards[j], s.cards[i]];
      }
      s.cards.forEach((c) => {
        c.zone = 'hand';
        delete c.discardedTurn;
      });
    } else s.turn++;
    s.phase = 'playing';
    s.revealed = false;
    s.monthEnded = false;
    s.battle = {};
    s.locked = { hero: false, demon: false };
    s.changes = { hero: 0, demon: 0 };
    s.last = null;
    return s;
  }
  if (command.type !== 'LOCK') throw new Error('无效操作');
  if (
    s.phase !== 'playing' ||
    !s.battle[command.side] ||
    s.locked[command.side]
  )
    throw new Error('请先选择卡牌，且不能重复锁定');
  s.locked[command.side] = true;
  if (!s.locked.hero || !s.locked.demon) return s;
  // 第二位玩家锁定时自动亮牌并原子结算，不存在客户端亮牌指令。

  const h = s.cards.find((c) => c.id === s.battle.hero)!;
  const d = s.cards.find((c) => c.id === s.battle.demon)!;
  const hr = h.role,
    dr = d.role;
  const rule = ruleFor(hr, dr, s.environment);
  s.revealed = true;

  if (s.armageddon) {
    const bothBosses = hr === 'HERO' && dr === 'DEMON';
    const anyBoss = boss(hr) || boss(dr);
    const challenger = s.armageddon;
    s.last = {
      environment: 'armageddon',
      roles: [hr, dr],
      value: 0,
      effects: [],
      swapped: false,
      swapCount: 0,
    };
    h.zone = d.zone = 'discard';
    h.discardedTurn = d.discardedTurn = s.turn;
    s.monthEnded = anyBoss;
    if (anyBoss) {
      s.winner = bothBosses
        ? challenger
        : challenger === 'hero'
          ? 'demon'
          : 'hero';
      s.winReason = 'armageddon';
      s.last.effects.push(
        bothBosses
          ? '善恶决战：双方 Boss 相遇，血量归零的一方成功捕获对方 Boss，获胜。'
          : '善恶决战：Boss 对上市民，血量大于 0 的一方获胜。',
      );
    } else
      s.last.effects.push(
        '善恶决战：市民对市民，不结算血量、不转换善恶、不交换归属；继续出牌。',
      );
    finish(s);
    return s;
  }

  s.hp.hero += rule.heroDelta;
  s.hp.demon += rule.demonDelta;
  s.last = {
    environment: s.environment,
    roles: [hr, dr],
    value: rule.value,
    effects: [rule.effect],
    swapped: false,
    swapCount: 0,
  };
  const key = [hr, dr];
  if (key.includes('EVIL') && key.includes('GOOD'))
    [h.owner, d.owner] = [d.owner, h.owner];
  if (rule.convertEvil && hr === 'HERO' && dr === 'EVIL') d.role = 'GOOD';
  if (dr === 'DEMON' && hr === 'GOOD') h.role = 'EVIL';
  if (rule.convertEvil && hr === 'EVIL' && dr === 'EVIL')
    h.role = d.role = 'GOOD';
  h.zone = d.zone = 'discard';
  h.discardedTurn = d.discardedTurn = s.turn;
  s.monthEnded = boss(hr) || boss(dr) || s.turn === 5;
  if (rule.swapHealth) {
    const before = { ...s.hp };
    [s.hp.hero, s.hp.demon] = [s.hp.demon, s.hp.hero];
    s.last.swapped = true;
    s.last.swapCount = 1;
    s.last.effects.push(
      `互换前：勇者 ${before.hero} / 魔王 ${before.demon}；互换后：勇者 ${s.hp.hero} / 魔王 ${s.hp.demon}。`,
    );
  }
  // 先伤害/回血，再执行全部互换，最后计算净得分（包括等待选目标阶段）。
  s.score = netScore(s);
  if (s.hp.hero <= 0 || s.hp.demon <= 0) finish(s);
  else if (hr === 'EVIL' && dr === 'DEMON' && targets(s).length)
    s.phase = 'targeting';
  else finish(s);
  return s;
}
// 所有本地/未来远程指令共用 Command；线上应在服务端调用 transition。
export interface GameTransport {
  send(command: Command): void;
  subscribe(listener: (state: State) => void): () => void;
}
export function randomCard(s: State, side: Side): Card | undefined {
  const hand = s.cards.filter((c) => c.owner === side && c.zone === 'hand');
  return hand[Math.floor(Math.random() * hand.length)];
}

/** 统计完整牌库，计入结算后的转换与交换归属。 */
export function citizenCounts(
  s: Pick<State, 'cards'>,
): Record<Side, { good: number; evil: number }> {
  const result = { hero: { good: 0, evil: 0 }, demon: { good: 0, evil: 0 } };
  for (const c of s.cards) {
    if (c.hidden) continue;
    if (c.role === 'GOOD') result[c.owner].good++;
    if (c.role === 'EVIL') result[c.owner].evil++;
  }
  return result;
}
