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
export function RuleTable() {
  const [selected, setSelected] = useState<[Role, Role]>(['HERO', 'DEMON']);
  const rule = ruleFor(...selected);
  const brief = (h: Role, d: Role) =>
    h === 'HERO'
      ? d === 'DEMON'
        ? '魔王 −5 血'
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
                const r = ruleFor(h, d);
                return (
                  <TableCell key={d}>
                    <button
                      className="matrix-cell"
                      aria-pressed={selected[0] === h && selected[1] === d}
                      aria-label={`${names[h]} vs ${names[d]}，结算 ${signed(r.value)}，${brief(h, d)}`}
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
                        {signed(r.value)}
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
        <strong>{signed(rule.value)}</strong>
        <p>{rule.effect}</p>
      </div>
      <div className="notes">
        <b>十二个月，善恶之争</b>
        <p>
          任一 Boss
          出战，结算后结束本月。弃牌和未出牌重新洗回手牌，市民转换永久保留。
        </p>
        <p>连续第 N 次 Boss 对决，伤害结算后互换 N−1 次血量。</p>
        <p>所有 8 名市民变善，勇者立即胜利；全部变恶，魔王立即胜利。</p>
        <p>12 月后净得分为正勇者胜，为负魔王胜，0 分平局。</p>
      </div>
    </aside>
  );
}
