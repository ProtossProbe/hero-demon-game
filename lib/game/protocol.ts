import type { Card, Command, Side, State } from './engine.ts';

export type RoomView = {
  roomId: string;
  me: Side;
  gameId: number;
  revision: number;
  phase: 'waiting' | 'active' | 'finished';
  connected: Record<Side, boolean>;
  ready: Record<Side, boolean>;
  nextReady: Record<Side, boolean>;
  state: State;
  targetOptions: Card[];
};
export type RoomAction = { type: 'READY' } | { type: 'DRAW_ALL' } | Command;
export type Reply =
  | { ok: true; view: RoomView; token?: string }
  | { ok: false; error: string };
