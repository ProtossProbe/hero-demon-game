import { netScore, type State, type Side } from '../lib/game/engine';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

/** 终局一经产生立即显示；唯一继续路径是重置为下一局。 */
export function GameResult({
  state,
  me,
  onRestart,
  waiting,
  onSwap,
  swapWaiting,
  swapRequested,
}: {
  state: State;
  me: Side;
  onRestart: () => void;
  waiting?: boolean;
  onSwap?: () => void;
  swapWaiting?: boolean;
  swapRequested?: boolean;
}) {
  const finished = state.phase === 'finished' && state.winner !== null;
  const draw = state.winner === 'draw';
  const won = state.winner === me;
  const myName = me === 'hero' ? '勇者' : '大魔王';
  const winnerName = state.winner === 'hero' ? '勇者' : '大魔王';
  const immediate =
    state.winReason === 'good'
      ? '所有市民均已感化为善良市民'
      : state.winReason === 'evil'
        ? '所有市民均已腐化为邪恶市民'
        : state.winReason === 'armageddon'
          ? (state.last?.effects.join(' ') ?? '善恶决战结束')
          : null;
  const score = netScore(state);
  return (
    <Dialog open={finished}>
      <DialogContent
        showCloseButton={false}
        className={`game-result ${draw ? 'draw' : won ? 'victory' : 'defeat'}`}
      >
        <div className="result-inner">
          <p className="result-eyebrow">
            {state.winReason === 'armageddon'
              ? '善恶决战 · 对局结束'
              : '阵营胜利 · 对局结束'}
          </p>
          <DialogTitle className="result-title">
            {draw ? '双方平局' : `${myName}${won ? '胜利' : '失败'}`}
          </DialogTitle>
          <DialogDescription className="result-description">
            {immediate ?? '对局已结束'}
            {draw ? '。双方血量相同。' : `。${winnerName}赢得本局。`}
          </DialogDescription>
          <div className="result-scores">
            <div>
              <span>勇者血量</span>
              <strong>{state.hp.hero}</strong>
            </div>
            <div>
              <span>魔王血量</span>
              <strong>{state.hp.demon}</strong>
            </div>
            <div>
              <span>勇者净得分</span>
              <strong>
                {score > 0 ? '+' : ''}
                {score}
              </strong>
            </div>
          </div>
          <p className="result-month">
            第 {state.month} 月 · 第 {state.turn} 回合
          </p>
          {onSwap && (
            <div>
              {swapRequested && <p role="status">对方希望交换阵营并重新开局</p>}
              <button
                className="secondary"
                disabled={swapWaiting}
                onClick={onSwap}
              >
                {swapWaiting ? '已申请交换，等待对方' : '交换阵营'}
              </button>
            </div>
          )}
          <button className="primary" onClick={onRestart} disabled={waiting}>
            {waiting ? '已准备，等待对方' : '准备开始下一局'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
