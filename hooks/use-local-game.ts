import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  newGame,
  transition,
  randomCard,
  targets,
  type State,
  type Side,
  type Command,
} from '../lib/game/engine';
export function useLocalGame() {
  const [state, setState] = useState<State>(newGame);
  const [gameId, setGameId] = useState(0);
  const [me, setMe] = useState<Side>('hero');
  const computer: Side = me === 'hero' ? 'demon' : 'hero';
  function restart(side: Side = me) {
    const fresh = newGame();
    fresh.cards.forEach((c) => (c.zone = c.owner === side ? 'deck' : 'hand'));
    setState(fresh);
    setGameId((id) => id + 1);
    setMe(side);
    setError('');
  }
  const [error, setError] = useState('');
  function send(command: Command) {
    try {
      let next = transition(state, command);
      if (next.phase === 'targeting' && computer === 'demon') {
        const choices = targets(next);
        next = transition(next, {
          type: 'TARGET',
          cardId: choices[Math.floor(Math.random() * choices.length)].id,
        });
      }
      setState(next);
      setError('');
      return next;
    } catch (e) {
      setError((e as Error).message);
    }
  }
  // 电脑独立于玩家操作随机选牌/换牌，然后锁定；无需额外亮牌按钮。
  useEffect(() => {
    if (state.phase !== 'playing' || state.locked[computer]) return;
    const timer = setTimeout(
      () =>
        setState((current) => {
          if (current.phase !== 'playing' || current.locked[computer])
            return current;
          let next = current;
          const card = randomCard(current, computer);
          if (
            !current.battle[computer] ||
            (card && current.changes[computer] < 2 && Math.random() < 0.35)
          ) {
            if (card)
              next = transition(current, {
                type: 'PLAY',
                side: computer,
                cardId: card.id,
              });
          } else next = transition(current, { type: 'LOCK', side: computer });
          if (next.phase === 'targeting' && computer === 'demon') {
            const choices = targets(next);
            next = transition(next, {
              type: 'TARGET',
              cardId: choices[Math.floor(Math.random() * choices.length)].id,
            });
          }
          return next;
        }),
      1600,
    );
    return () => clearTimeout(timer);
  }, [
    state.phase,
    state.battle[computer],
    state.locked[computer],
    state.month,
    state.turn,
    computer,
    gameId,
  ]);
  const actionsRef = useRef({ send, state, me });
  actionsRef.current = { send, state, me };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: object,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'play_local_card_game',
          description:
            '加入手牌、换牌、撤回、锁定出牌、指定腐化目标或进入下一回合，操作与页面按钮一致。',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['DRAW', 'PLAY', 'WITHDRAW', 'LOCK', 'TARGET', 'NEXT'],
              },
              cardId: { type: 'string' },
            },
            required: ['action'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            const value = input as { action?: string; cardId?: string };
            if (
              !value ||
              !['DRAW', 'PLAY', 'WITHDRAW', 'LOCK', 'TARGET', 'NEXT'].includes(
                value.action ?? '',
              )
            )
              throw new Error('无效操作');
            const action = value.action!;
            if (
              ['DRAW', 'PLAY', 'TARGET'].includes(action) &&
              typeof value.cardId !== 'string'
            )
              throw new Error('缺少 cardId');
            const command = {
              type: action,
              side: actionsRef.current.me,
              cardId: value.cardId,
            } as Command;
            let result: State | undefined;
            flushSync(() => {
              result = actionsRef.current.send(command);
            });
            if (!result) throw new Error('操作被当前状态拒绝');
            return {
              month: result.month,
              turn: result.turn,
              phase: result.phase,
              hp: result.hp,
              score: result.score,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  return { state, setState, me, computer, restart, send, error, gameId };
}
