import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import GameBoard from './page';
import { useLocalGame } from '../hooks/use-local-game';
import type { Reply, RoomAction, RoomView } from '../lib/game/protocol';
import type { Command, Side } from '../lib/game/engine';
const configured =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SERVER_URL || '';
function Local() {
  return <GameBoard game={useLocalGame()} />;
}
function Online() {
  const [url, setUrl] = useState(
    configured ||
      localStorage.getItem('game-server') ||
      'http://localhost:3001',
  );
  const [endpoint, setEndpoint] = useState(url);
  const [view, setView] = useState<RoomView | null>(null),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [code, setCode] = useState('');
  const socket = useRef<Socket | null>(null),
    current = useRef<RoomView | null>(null);
  const key = `hero-demon-seat:${endpoint}`;
  function accept(reply: Reply) {
    if (!reply.ok) {
      setError(reply.error);
      return;
    }
    const v = reply.view;
    if (
      !current.current ||
      current.current.roomId !== v.roomId ||
      v.revision >= current.current.revision
    ) {
      current.current = v;
      setView(v);
    }
    if (reply.token)
      sessionStorage.setItem(
        key,
        JSON.stringify({ roomId: v.roomId, token: reply.token }),
      );
    setError('');
  }
  useEffect(() => {
    const client = io(endpoint, { transports: ['websocket', 'polling'] });
    socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      const saved = sessionStorage.getItem(key);
      if (saved) {
        try {
          client.emit('room:resume', JSON.parse(saved), (reply: Reply) => {
            if (!reply.ok) {
              sessionStorage.removeItem(key);
              current.current = null;
              setView(null);
            }
            accept(reply);
          });
        } catch {
          sessionStorage.removeItem(key);
        }
      }
    });
    client.on('room:state', (v: RoomView) => accept({ ok: true, view: v }));
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => {
      setConnected(false);
      setError('正在连接服务器；免费服务首次唤醒可能需要约一分钟。');
    });
    return () => {
      client.disconnect();
      socket.current = null;
    };
  }, [endpoint]);
  function emit(event: string, data: unknown) {
    if (!socket.current?.connected) {
      setError('连接尚未恢复，请稍候');
      return;
    }
    socket.current
      .timeout(10000)
      .emit(event, data, (err: Error | null, reply: Reply) => {
        if (err) setError('请求超时，请等待状态同步后重试');
        else accept(reply);
      });
  }
  function action(action: RoomAction) {
    const v = current.current;
    if (v)
      emit('game:action', {
        gameId: v.gameId,
        month: v.state.month,
        turn: v.state.turn,
        action,
      });
  }
  const ready = () => action({ type: 'READY' });
  const swapSides = () => action({ type: 'SWAP_SIDES' });
  const both = !!view?.connected.hero && !!view?.connected.demon;
  return (
    <>
      <div className="connection-bar">
        <b>{connected ? '● 已连接' : '○ 连接中'}</b>
        {view && (
          <>
            <span>
              房间 {view.roomId} · 你是{view.me === 'hero' ? '勇者' : '魔王'}
            </span>
            <button
              className="secondary"
              disabled={!connected || !both || view.swapReady?.[view.me]}
              onClick={swapSides}
              title="双方同意后，交换阵营并重新开始一局"
            >
              {view.swapReady?.[view.me] ? '已申请交换，等待对方' : '交换阵营'}
            </button>
            {view.swapReady?.[view.me === 'hero' ? 'demon' : 'hero'] && (
              <span role="status">对方希望交换阵营并重新开局</span>
            )}
            <span>{both ? '双方在线' : '等待对方连接，暂不能操作'}</span>
            <button
              className="secondary"
              onClick={() => {
                sessionStorage.removeItem(key);
                location.reload();
              }}
            >
              离开房间
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!view ? (
        <section className="lobby">
          <h1>在线双人对战</h1>
          <p>一人创建房间，另一人输入房间码；双方准备后开始。</p>
          <details>
            <summary>服务器地址</summary>
            <input
              aria-label="服务器地址"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              onClick={() => {
                localStorage.setItem('game-server', url);
                setEndpoint(url);
              }}
            >
              连接
            </button>
          </details>
          <div className="lobby-actions">
            <button
              className="primary"
              disabled={!connected}
              onClick={() => emit('room:create', { side: 'hero' })}
            >
              创建房间 · 勇者
            </button>
            <button
              className="secondary"
              disabled={!connected}
              onClick={() => emit('room:create', { side: 'demon' })}
            >
              创建房间 · 魔王
            </button>
          </div>
          <input
            aria-label="房间码"
            placeholder="输入 6 位房间码"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            className="primary"
            disabled={!connected || code.length !== 6}
            onClick={() => emit('room:join', { roomId: code })}
          >
            加入房间
          </button>
        </section>
      ) : view.phase === 'waiting' ? (
        <section className="lobby">
          <h1>房间 {view.roomId}</h1>
          <p>将房间码告诉另一名玩家。双方进入并点击准备后开始。</p>
          <p>
            勇者：{view.connected.hero ? '在线' : '未连接'}{' '}
            {view.ready.hero ? '· 已准备' : ''}　魔王：
            {view.connected.demon ? '在线' : '未连接'}{' '}
            {view.ready.demon ? '· 已准备' : ''}
          </p>
          <button
            className="primary"
            disabled={!connected || !both || view.ready[view.me]}
            onClick={ready}
          >
            {view.ready[view.me] ? '已准备，等待对方' : '准备开始'}
          </button>
        </section>
      ) : (
        <GameBoard
          game={{
            state: view.state,
            setState: () => {},
            me: view.me,
            computer: view.me === 'hero' ? 'demon' : 'hero',
            gameId: view.gameId,
            error: '',
            restart: (_side?: Side) => ready(),
            send: (command: Command) => {
              action(command);
              return undefined;
            },
          }}
          online={{
            roomId: view.roomId,
            swapSides,
            swapWaiting: !!view.swapReady?.[view.me],
            swapRequested:
              !!view.swapReady?.[view.me === 'hero' ? 'demon' : 'hero'],
            nextReady: view.nextReady[view.me],
            rematchReady: view.ready[view.me],
            targetOptions: view.targetOptions,
            citizenCounts: view.citizenCounts,
            drawAll: () => action({ type: 'DRAW_ALL' }),
          }}
        />
      )}
    </>
  );
}
export default function GameApp() {
  const [online, setOnline] = useState(
    !!configured || !!sessionStorage.getItem('online-mode'),
  );
  return (
    <>
      <nav className="connection-bar">
        <button
          className="secondary"
          onClick={() => {
            setOnline(false);
            sessionStorage.removeItem('online-mode');
          }}
        >
          本地人机
        </button>
        <button
          className="secondary"
          onClick={() => {
            setOnline(true);
            sessionStorage.setItem('online-mode', '1');
          }}
        >
          在线双人
        </button>
      </nav>
      {online ? <Online /> : <Local />}
    </>
  );
}
