import React from 'react';
import { createRoot } from 'react-dom/client';
import GameBoard from './game-app';
import './globals.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameBoard />
  </React.StrictMode>,
);
