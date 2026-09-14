import { GameResult } from '../components/game-result';
import { useHandOrder } from '../hooks/use-hand-order';
import { MonthNotice } from '../components/month-notice';
import {
  transition,
  targets,
  names,
  citizenCounts,
  environmentNames,
  GAME_VERSION,
} from '../lib/game/engine';
import { PlayingCard } from '../components/playing-card';
import { RuleTable } from '../components/rule-table';
import { useLocalGame } from '../hooks/use-local-game';
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
type Online = {
  swapSides: () => void;
  swapWaiting: boolean;
  swapRequested: boolean;
  citizenCounts: ReturnType<typeof citizenCounts>;
  roomId: string;
  nextReady: boolean;
  rematchReady: boolean;
  targetOptions: ReturnType<typeof targets>;
  drawAll: () => void;
};
export default function GameBoard({
  game,
  online,
}: {
  game: ReturnType<typeof useLocalGame>;
  online?: Online;
}) {
  const { state, setState, me, computer, restart, send, error, gameId } = game;
  const drop = (type: 'DRAW' | 'PLAY') => (e: React.DragEvent) => {
    e.preventDefault();
    send({ type, side: me, cardId: e.dataTransfer.getData('text/plain') });
  };
  const { hand, move } = useHandOrder(
    state.cards.filter((c) => c.owner === me && c.zone === 'hand'),
    `${gameId}-${me}-${state.month}`,
  );
  function dropOnHand(e: React.DragEvent, targetId?: string, after = false) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    if (hand.some((c) => c.id === id)) move(id, targetId, after);
    else if (id === state.battle[me]) send({ type: 'WITHDRAW', side: me });
    else send({ type: 'DRAW', side: me, cardId: id });
  }
  const deck = state.cards.filter((c) => c.owner === me && c.zone === 'deck');
  const opponent = state.cards.filter(
    (c) => c.owner === computer && c.zone === 'hand',
  );

  const counts = online?.citizenCounts ?? citizenCounts(state);
  const counter = (side: typeof me) => (
    <span
      className="citizen-count"
      aria-label={`${side === 'hero' ? '勇者' : '魔王'}牌库：${counts[side].good}善/${counts[side].evil}恶`}
      title="完整牌库，包含手牌、战场与弃牌"
    >
      <span className="count-good">{counts[side].good}善</span>/
      <span className="count-evil">{counts[side].evil}恶</span>
    </span>
  );
  const playing = state.phase === 'playing';
  return (
    <div
      className={`app ${state.armageddon ? 'armageddon' : state.environment === 'blood' ? 'blood-moon' : state.environment === 'bright' ? 'bright-moon' : ''}`}
    >
      <GameResult
        state={state}
        me={me}
        onRestart={() => restart()}
        waiting={online?.rematchReady}
        onSwap={online?.swapSides}
        swapWaiting={online?.swapWaiting}
        swapRequested={online?.swapRequested}
      />
      <header>
        <div>
          <small>大魔王 · 勇者 · 市民 VARIATION</small>
          <h1>
            勇者斗大魔王 <small>v{GAME_VERSION}</small>
          </h1>
        </div>
        <div className="header-actions">
          <span className="mode">
            ● {online ? `双人房间 ${online.roomId}` : '本地人机'}
          </span>
          {!online && (
            <>
              <button className="secondary" onClick={() => restart(computer)}>
                改玩{me === 'hero' ? '魔王' : '勇者'}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  restart();
                }}
              >
                重新开始
              </button>
            </>
          )}
        </div>
      </header>
      <div className="layout">
        <RuleTable
          armageddon={!!state.armageddon}
          environment={state.environment}
        />
        <main>
          <div className="status-bar">
            <div>
              <small>当前月份</small>
              <b>
                {String(state.month).padStart(2, '0')} <span>月</span>
              </b>
            </div>
            <div>
              <small>本月回合</small>
              <b>
                {state.turn} <span>/ 5</span>
              </b>
            </div>
            <div>
              <small>勇者净得分</small>
              <b className={state.score >= 0 ? 'positive' : 'negative'}>
                {signed(state.score)}
              </b>
            </div>
            <div>
              <small>本月环境</small>
              <b>
                {state.armageddon
                  ? '善恶决战'
                  : environmentNames[state.environment]}
              </b>
            </div>
          </div>
          <section className="arena">
            {state.armageddon && (
              <p className="armageddon-notice" role="status">
                ARMAGEDDON · 善恶决战：
                {state.armageddon === 'hero' ? '勇者' : '魔王'}需要抓到对方
                Boss。双方 Boss 相遇，该方胜；任一 Boss
                对市民，另一方胜。市民对市民不结算。
              </p>
            )}
            <div className="player-heading">
              <div>
                <span className={`badge ${computer}`}>
                  {computer === 'hero' ? '勇' : '魔'}
                </span>
                <b>{computer === 'hero' ? '勇者' : '大魔王'}</b>
                <small>{online ? '在线玩家' : '电脑 · 随机出牌'}</small>
              </div>
              <b className="hp">
                ♥ {state.hp[computer]} <small>血量</small>
              </b>
            </div>
            <MonthNotice
              key={`opponent-${gameId}-${state.month}`}
              month={state.month}
              environment={state.environment}
              armageddon={!!state.armageddon}
            />
            <div className="hand opponent">
              {counter(computer)}
              {opponent.map((c) => (
                <PlayingCard card={c} key={c.id} hidden />
              ))}
              {!opponent.length && <p className="muted">手牌已出完</p>}
            </div>
            <div className="battle">
              {([computer, me] as const).map((side, index) => (
                <div
                  className={`past-cards ${index === 0 ? 'past-opponent' : 'past-own'}`}
                  key={side}
                  aria-label={`${side === 'hero' ? '勇者' : '魔王'}本月已结算卡牌`}
                >
                  {state.cards
                    .filter(
                      (c) =>
                        c.owner === side &&
                        c.zone === 'discard' &&
                        (c.discardedTurn ?? state.turn) < state.turn,
                    )
                    .map((c) => (
                      <span
                        key={c.id}
                        className={`past-card role-${c.role.toLowerCase()}`}
                        title={`${names[c.role]} · 第 ${c.discardedTurn} 回合 · ${side === 'hero' ? '勇者' : '魔王'}牌库`}
                      >
                        {
                          { GOOD: '善', EVIL: '恶', HERO: '勇', DEMON: '魔' }[
                            c.role
                          ]
                        }
                      </span>
                    ))}
                </div>
              ))}
              <div
                className="battle-slot"
                onDragOver={(e) => e.preventDefault()}
                onDrop={drop('PLAY')}
              >
                <small>我方 · {state.locked[me] ? '已锁定' : '可换牌'}</small>
                {state.battle[me] ? (
                  <PlayingCard
                    action={
                      playing && !!state.battle[me] && !state.locked[me]
                        ? () => send({ type: 'WITHDRAW', side: me })
                        : undefined
                    }
                    card={{
                      ...state.cards.find((c) => c.id === state.battle[me])!,
                      role:
                        state.last?.roles[me === 'hero' ? 0 : 1] ??
                        state.cards.find((c) => c.id === state.battle[me])!
                          .role,
                    }}
                  />
                ) : (
                  <div className="drop-hint">
                    ＋
                    <span>
                      拖动手牌至此
                      <br />
                      或点击手牌出战
                    </span>
                  </div>
                )}
              </div>
              <div className="battle-center">
                <small>ROUND {state.turn}</small>
                <strong>VS</strong>
                <span>
                  {state.revealed
                    ? '已亮牌'
                    : state.locked[me]
                      ? '等待对方锁定'
                      : ''}
                </span>
              </div>
              <div className="battle-slot">
                <small>
                  对方 · {state.locked[computer] ? '已锁定' : '可换牌'}
                </small>
                {state.battle[computer] ? (
                  <PlayingCard
                    card={{
                      ...state.cards.find(
                        (c) => c.id === state.battle[computer],
                      )!,
                      role:
                        state.last?.roles[computer === 'hero' ? 0 : 1] ??
                        state.cards.find(
                          (c) => c.id === state.battle[computer],
                        )!.role,
                    }}
                    hidden={!state.revealed}
                  />
                ) : (
                  <div className="drop-hint">
                    ◆<span>等待对方出牌</span>
                  </div>
                )}
              </div>
            </div>
            <div className="resolution" aria-live="polite">
              {state.last ? (
                <>
                  <b>本次结算 {signed(state.last.value)}</b>
                  <span>
                    {state.last.effects.join(' ')}
                    {state.last.swapped ? ' 本次血量已互换。' : ''}
                  </span>
                </>
              ) : (
                <span>锁定前可换牌或撤回；双方锁定后自动亮牌结算。</span>
              )}
              {state.winner && (
                <strong className="winner">
                  {state.winner === 'draw'
                    ? '平局'
                    : state.winner === 'hero'
                      ? '勇者获胜'
                      : '大魔王获胜'}{' '}
                  · 游戏结束
                </strong>
              )}
            </div>
            {state.phase === 'targeting' && me === 'demon' && (
              <div className="target-picker">
                <b>指定一名善良市民腐化</b>
                <p>可选择双方完整牌库中的任意善良市民，包括手牌和弃牌。</p>
                {(online?.targetOptions ?? targets(state)).map((c) => (
                  <button
                    className="secondary"
                    key={c.id}
                    onClick={() => send({ type: 'TARGET', cardId: c.id })}
                  >
                    {c.owner === me ? '我方' : '对方'} · 善良市民 {c.id}
                  </button>
                ))}
              </div>
            )}
            <div className="controls">
              {playing ? (
                <button
                  className="primary"
                  disabled={!state.battle[me] || state.locked[me]}
                  onClick={() => send({ type: 'LOCK', side: me })}
                >
                  {state.locked[me] ? '已锁定，等待对方' : '锁定出牌'}
                </button>
              ) : state.phase === 'resolved' ? (
                <button
                  className="primary"
                  disabled={online?.nextReady}
                  onClick={() => send({ type: 'NEXT' })}
                >
                  {online?.nextReady
                    ? '已准备，等待对方'
                    : state.armageddonPending
                      ? '收回手牌，开始善恶决战 →'
                      : state.monthEnded
                        ? '进入下一个月 →'
                        : '下一回合 →'}
                </button>
              ) : state.phase === 'targeting' ? (
                <span>等待魔王选择腐化目标，之后完成结算</span>
              ) : (
                <button className="primary" onClick={() => restart()}>
                  再来一局
                </button>
              )}
              <span className="muted">
                {state.monthEnded ? '本月已结束' : '锁定后不可撤回'}
              </span>
            </div>
            <div className="player-heading">
              <div>
                <span className={`badge ${me}`}>
                  {me === 'hero' ? '勇' : '魔'}
                </span>
                <b>{me === 'hero' ? '勇者' : '大魔王'}</b>
                <small>你 · 手牌仅自己可见</small>
              </div>
              <b className="hp">
                ♥ {state.hp[me]} <small>血量</small>
              </b>
            </div>
            <MonthNotice
              key={`own-${gameId}-${state.month}`}
              month={state.month}
              environment={state.environment}
              armageddon={!!state.armageddon}
            />
            <p className="hand-instruction">
              拖动手牌可排序；拖到战场可换牌，点击战场卡牌或拖回手牌可撤回。
            </p>
            <div
              className="hand own"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOnHand(e)}
            >
              {counter(me)}
              {hand.map((c) => (
                <div
                  className="hand-card"
                  key={c.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const bounds = e.currentTarget.getBoundingClientRect();
                    dropOnHand(
                      e,
                      c.id,
                      e.clientX > bounds.left + bounds.width / 2,
                    );
                  }}
                >
                  <PlayingCard
                    key={c.id}
                    card={c}
                    disabled={!playing || state.locked[me]}
                    reorderable
                    action={() =>
                      send({ type: 'PLAY', side: me, cardId: c.id })
                    }
                  />
                </div>
              ))}
              {!hand.length && (
                <p className="muted">
                  将下方牌库的牌拖入此处，或点击牌加入手牌
                </p>
              )}
            </div>
            {deck.length > 0 && (
              <div className="draw-area">
                <div className="section-title">
                  <span>初始牌库 · 拖入上方手牌区</span>
                  <button
                    className="secondary"
                    disabled={!playing}
                    onClick={() => {
                      if (online) {
                        online.drawAll();
                        return;
                      }
                      let next = state;
                      for (const c of deck)
                        next = transition(next, {
                          type: 'DRAW',
                          side: me,
                          cardId: c.id,
                        });
                      setState(next);
                    }}
                  >
                    全部加入手牌
                  </button>
                </div>
                <div className="hand">
                  {deck.map((c) => (
                    <PlayingCard
                      key={c.id}
                      card={c}
                      disabled={!playing}
                      action={() =>
                        send({ type: 'DRAW', side: me, cardId: c.id })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="discard">
              <span>本月弃牌</span>
              {(['hero', 'demon'] as const).map((side) => (
                <p key={side}>
                  {side === me ? '我方' : '对方'}：
                  {state.cards
                    .filter((c) => c.owner === side && c.zone === 'discard')
                    .map((c) => names[c.role])
                    .join('、') || '暂无'}
                </p>
              ))}
            </div>
          </section>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="assumption">
            月数无上限，净得分仅展示血量差，不用于判胜。全善／全恶直接获胜；否则任一方血量
            ≤ 0
            进入善恶决战。普通月符合条件进入朗月；朗月之后必为血月，血月之后必为普通月。朗月吸血与免伤；血月邪恶伤害加倍、禁止感化，Boss
            对决只交换血量。进入决战后冻结血量及阵营效果。
          </div>
          <section className="history">
            <div className="section-title">
              <span>战斗记录</span>
              <small>{state.history.length} 回合已结算</small>
            </div>
            {state.history.length ? (
              state.history.map((entry, i) => (
                <p key={i}>
                  <strong
                    className={`log-environment log-${entry.environment}`}
                  >
                    【{environmentNames[entry.environment]}】
                  </strong>
                  {entry.text}
                </p>
              ))
            ) : (
              <p className="muted">双方锁定后，结算记录将显示在这里。</p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
