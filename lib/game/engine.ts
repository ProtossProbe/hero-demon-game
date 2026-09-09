export type Role = 'HERO' | 'DEMON' | 'GOOD' | 'EVIL';
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
    effect:
      '魔王受到 5 点伤害；本月结束；连续第 N 个月 Boss 对决，结算后互换 N−1 次血量。',
  },
  { roles: ['HERO', 'GOOD'], value: 0, effect: '无市民转换；本月结束。' },
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
export function ruleFor(a: Role, b: Role) {
  const rule = rules.find(
    (r) =>
      (r.roles[0] === a && r.roles[1] === b) ||
      (r.roles[0] === b && r.roles[1] === a),
  );
  if (!rule) throw new Error('无效的角色组合');
  return rule;
}
export type State = {
  cards: Card[];
  month: number;
  turn: number;
  totalMonths: number;
  hp: Record<Side, number>;
  /** 派生值：始终等于勇者血量减魔王血量。 */
  score: number;
  bossStreak: number;
  phase: 'playing' | 'targeting' | 'resolved' | 'finished';
  revealed: boolean;
  monthEnded: boolean;
  winner: Side | 'draw' | null;
  winReason?: 'good' | 'evil' | 'months';
  battle: Partial<Record<Side, string>>;
  locked: Record<Side, boolean>;
  changes: Record<Side, number>;
  last: null | {
    roles: Role[];
    value: number;
    effects: string[];
    swapped: boolean;
    swapCount: number;
  };
  history: string[];
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
    totalMonths: 12,
    hp: { hero: 20, demon: 20 },
    score: 0,
    bossStreak: 0,
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
  if (citizens.every((c) => c.role === 'GOOD')) { s.winner = 'hero'; s.winReason = 'good'; }
  if (citizens.every((c) => c.role === 'EVIL')) { s.winner = 'demon'; s.winReason = 'evil'; }
  if (!s.winner && s.monthEnded && s.month === s.totalMonths) {
    s.winner = s.score > 0 ? 'hero' : s.score < 0 ? 'demon' : 'draw';
    s.winReason = 'months';
  }
  s.phase = s.winner ? 'finished' : 'resolved';
  s.history.unshift(
    `第 ${s.month} 月 · 回合 ${s.turn}：${s.last!.roles.map((r) => names[r]).join(' vs ')}，${s.last!.value > 0 ? '+' : ''}${s.last!.value}；${s.last!.effects.join(' ')}`,
  );
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
      s.month++;
      s.turn = 1;
      // 洗牌只改变顺序，身份、归属和转换永久保留。
      for (let i = s.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.cards[i], s.cards[j]] = [s.cards[j], s.cards[i]];
      }
      s.cards.forEach((c) => { c.zone = 'hand'; delete c.discardedTurn; });
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
  const rule = ruleFor(hr, dr);
  s.revealed = true;

  if (hr === 'HERO' && dr === 'EVIL') s.hp.hero -= 3;
  if (dr === 'DEMON' && (hr === 'GOOD' || hr === 'EVIL')) s.hp.demon += 1;
  if (hr === 'HERO' && dr === 'DEMON') s.hp.demon -= 5;
  if (hr === 'GOOD' && dr === 'GOOD') s.hp.hero += 1;
  if (hr === 'EVIL' && dr === 'EVIL') s.hp.hero -= 2;
  s.last = {
    roles: [hr, dr],
    value: rule.value,
    effects: [rule.effect],
    swapped: false,
    swapCount: 0,
  };
  const key = [hr, dr];
  if (key.includes('EVIL') && key.includes('GOOD'))
    [h.owner, d.owner] = [d.owner, h.owner];
  if (hr === 'HERO' && dr === 'EVIL') d.role = 'GOOD';
  if (dr === 'DEMON' && hr === 'GOOD') h.role = 'EVIL';
  if (hr === 'EVIL' && dr === 'EVIL') h.role = d.role = 'GOOD';
  h.zone = d.zone = 'discard';
  h.discardedTurn = d.discardedTurn = s.turn;
  s.monthEnded = boss(hr) || boss(dr) || s.turn === 5;
  if (s.monthEnded) {
    if (hr === 'HERO' && dr === 'DEMON') {
      s.bossStreak++;
      if (s.bossStreak >= 2) {
        s.last.swapCount = s.bossStreak - 1;
        for (let i = 0; i < s.last.swapCount; i++)
          [s.hp.hero, s.hp.demon] = [s.hp.demon, s.hp.hero];
        s.last.swapped = true;
        s.last.effects.push(
          `连续 ${s.bossStreak} 次 Boss 对决，实际互换 ${s.last.swapCount} 次血量。`,
        );
      }
    } else s.bossStreak = 0;
  }
  // 先伤害/回血，再执行全部互换，最后计算净得分（包括等待选目标阶段）。
  s.score = netScore(s);
  if (hr === 'EVIL' && dr === 'DEMON' && targets(s).length)
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
