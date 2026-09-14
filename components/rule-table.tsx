import { useState } from 'react';
import {
  names,
  ruleFor,
  environmentNames,
  type Environment,
  type Role,
} from '../lib/game/engine';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table';
const heroRoles: Role[] = ['HERO', 'GOOD', 'EVIL'];
const demonRoles: Role[] = ['DEMON', 'GOOD', 'EVIL'];
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export function RuleTable({
  armageddon = false,
  environment = 'normal',
}: {
  armageddon?: boolean;
  environment?: Environment;
}) {
  const [selected, setSelected] = useState<[Role, Role]>(['HERO', 'DEMON']);
  const lookup = (h: Role, d: Role) => ruleFor(h, d, environment);
  const baseRule = lookup(...selected);
  const duelEffect = (h: Role, d: Role) =>
    h === 'HERO' && d === 'DEMON'
      ? '双方 Boss 相遇：血量 ≤ 0 的一方获胜。'
      : h === 'HERO' || d === 'DEMON'
        ? 'Boss 对市民：血量大于 0 的一方获胜。'
        : '市民对市民：血量、善恶及归属不变，继续出牌。';
  const rule = armageddon
    ? { ...baseRule, value: 0, effect: duelEffect(...selected) }
    : baseRule;
  const brief = (h: Role, d: Role) => {
    if (armageddon) return duelEffect(h, d);
    const r = lookup(h, d);
    if (r.swapHealth) return '直接互换血量';
    if (h === 'HERO' && d === 'DEMON')
      return r.heroDelta
        ? `勇者 +${r.heroDelta}／魔王 ${r.demonDelta}`
        : `魔王 ${r.demonDelta} 血`;
    if ((h === 'HERO' && d === 'EVIL') || (h === 'EVIL' && d === 'EVIL'))
      return `${r.heroDelta ? `勇者 ${r.heroDelta} 血` : '勇者免伤'} · ${r.convertEvil ? '感化' : '不感化'}`;
    if (d === 'DEMON')
      return `魔王 +${r.demonDelta} 血 · ${h === 'GOOD' ? '腐化' : '指定'}`;
    if (h === 'GOOD' && d === 'GOOD') return `勇者 +${r.heroDelta} 血`;
    if (h === 'HERO') return '无变化';
    return '交换市民';
  };
  return (
    <aside className="rule-panel">
      <div className="section-title">
        <span>
          对战规则矩阵 ·{' '}
          {armageddon ? '善恶决战' : environmentNames[environment]}
        </span>
        <small>勇者方 × 魔王方</small>
      </div>
      <p className="muted">
        行：勇者方出牌 · 列：魔王方出牌
        <br />
        点击任意结果格查看完整规则
      </p>
      <Table className="rule-matrix">
        <TableHeader>
          <TableRow>
            <TableHead>勇 ↓ 魔 →</TableHead>
            {demonRoles.map((d) => (
              <TableHead key={d} scope="col">
                {names[d]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {heroRoles.map((h) => (
            <TableRow key={h}>
              <TableHead scope="row">{names[h]}</TableHead>
              {demonRoles.map((d) => {
                const r = armageddon ? { value: 0 } : lookup(h, d);
                return (
                  <TableCell key={d}>
                    <button
                      className="matrix-cell"
                      aria-pressed={selected[0] === h && selected[1] === d}
                      aria-label={`${names[h]} vs ${names[d]}，结算 ${armageddon ? '决战' : signed(r.value)}，${brief(h, d)}`}
                      onClick={() => setSelected([h, d])}
                    >
                      <strong
                        className={
                          r.value > 0
                            ? 'positive'
                            : r.value < 0
                              ? 'negative'
                              : ''
                        }
                      >
                        {armageddon ? '决战' : signed(r.value)}
                      </strong>
                      <span>{brief(h, d)}</span>
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="rule-detail" aria-live="polite">
        <b>{selected.map((r) => names[r]).join(' vs ')}</b>
        <strong>{armageddon ? '决战' : signed(rule.value)}</strong>
        <p>{rule.effect}</p>
      </div>
      <div className="notes">
        <b>善恶之争 · 月数无上限</b>
        <p>
          任一 Boss
          出战，结算后结束本月。弃牌和未出牌重新洗回手牌，市民转换永久保留。
        </p>
        <p>
          普通月：沿用基础规则；以勇者对魔王或勇者对善良结束，下个月为朗月，否则仍为普通月。
        </p>
        <p>
          朗月：勇者对魔王吸血（勇者 +5／魔王
          −5），不互换；勇者对邪恶、邪恶对邪恶不掉血，感化照常。下个月必为血月。
        </p>
        <p>
          血月：勇者对邪恶扣 6 血，邪恶对邪恶勇者扣 4
          血；所有邪恶不转善，但善恶市民交换归属、善良被腐化照常。勇者对魔王直接互换血量，不造成伤害、不回血。下个月必为普通月。
        </p>
        <p>
          所有 8
          名市民变善，勇者直接胜利；全部变恶，魔王直接胜利。阵营胜利不触发善恶决战，优先于血量归零。
        </p>
        <p>
          否则任一方血量 ≤
          0，触发金色环境「善恶决战」。双方确认后，各自收回当前牌库的全部牌，保留已转换的善恶与归属。
        </p>
        <p>
          决战中双方 Boss 相遇，血量 ≤ 0 的一方胜；任一 Boss 对市民，血量大于 0
          的一方胜。市民对市民不结算血量、不转换善恶、不交换归属，继续出牌。
        </p>
        <p>
          月份持续累计，不再按血量差或月份判胜。善恶决战期间不触发血月互换。
        </p>
      </div>
    </aside>
  );
}
