import { useState } from 'react';
import type { Card } from '../lib/game/engine';
/** 手牌排序仅影响本地展示，不改变牌库、随机概率或出牌状态。 */
export function useHandOrder(cards: Card[], resetKey: string) {
  const [order, setOrder] = useState<{ key: string; ids: string[] }>({
    key: resetKey,
    ids: [],
  });
  const ids = order.key === resetKey ? order.ids : [];
  const hand = [...cards].sort((a, b) => {
    const ai = ids.indexOf(a.id),
      bi = ids.indexOf(b.id);
    return (
      (ai < 0 ? ids.length + cards.indexOf(a) : ai) -
      (bi < 0 ? ids.length + cards.indexOf(b) : bi)
    );
  });
  function move(cardId: string, targetId?: string, after = false) {
    if (!hand.some((c) => c.id === cardId) || targetId === cardId) return;
    const next = hand.map((c) => c.id).filter((id) => id !== cardId);
    const index = targetId ? next.indexOf(targetId) : -1;
    next.splice(index < 0 ? next.length : index + Number(after), 0, cardId);
    setOrder({ key: resetKey, ids: next });
  }
  return { hand, move };
}
