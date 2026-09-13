import { useState } from 'react';
import { names, ruleFor, type Role } from '../lib/game/engine';
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
  bloodMoon = false,
}: {
  armageddon?: boolean;
  bloodMoon?: boolean;
}) {
  const [selected, setSelected] = useState<[Role, Role]>(['HERO', 'DEMON']);
  const lookup = (h: Role, d: Role) => {
    const rule = ruleFor(h, d);
    return bloodMoon && h === 'HERO' && d === 'DEMON'
      ? { ...rule, value: 10 }
      : rule;
  };
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
  const brief = (h: Role, d: Role) =>
    armageddon
      ? duelEffect(h, d)
      : h === 'HERO'
        ? d === 'DEMON'
          ? bloodMoon
            ? '勇者 +5 血 · 魔王 −5 血 · 互换'
            : '魔王 −5 血'
          : d === 'GOOD'
            ? '无变化'
            : '勇者 −3 血 · 感化'
        : h === 'GOOD'
          ? d === 'DEMON'
            ? '魔王 +1 血 · 腐化'
            : d === 'GOOD'
              ? '勇者 +1 血'
              : '交换市民'
          : d === 'DEMON'
            ? '魔王 +1 血 · 指定'
            : d === 'GOOD'
              ? '交换市民'
              : '勇者 −2 血 · 感化';
  return (
    <aside className="rule-panel">
      <div className="section-title">
        <span>对战规则矩阵</span>
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
          血月：上个月勇者与大魔王对决，则本月为血月。血月中勇者回复 5
          血、魔王扣除 5 血，双方存活才互换一次血量；未再次 Boss
          对决则下月恢复普通月。
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
