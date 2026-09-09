import { names, type Card } from '../lib/game/engine';
const symbols = { HERO: '勇', DEMON: '魔', GOOD: '善', EVIL: '恶' };
export function PlayingCard({
  card,
  hidden = false,
  action,
  disabled = false,
  reorderable = false,
}: {
  card: Card;
  hidden?: boolean;
  action?: () => void;
  disabled?: boolean;
  reorderable?: boolean;
}) {
  return (
    <button
      className={`playing-card ${hidden ? 'back' : card.role}`}
      aria-disabled={disabled}
      disabled={disabled && !reorderable}
      draggable={reorderable || (!!action && !disabled)}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={disabled ? undefined : action}
      aria-label={
        hidden
          ? '对方隐藏手牌'
          : `${names[card.role]} ${card.id}${action ? '，点击或拖拽' : ''}`
      }
    >
      <small>{hidden ? 'VARIATION' : card.role}</small>
      <strong>{hidden ? '◆' : symbols[card.role]}</strong>
      <span>{hidden ? '隐藏手牌' : names[card.role]}</span>
      {!hidden && <small title={card.id}>{card.id.length > 12 ? card.id.slice(0, 6) : card.id}</small>}
    </button>
  );
}
