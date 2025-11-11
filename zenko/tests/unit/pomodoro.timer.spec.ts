import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { usePomodoroStore } from '../../frontend/src/features/pomodoro/store';

describe('Pomodoro timer state machine', () => {
  beforeEach(() => {
    usePomodoroStore.setState({
      duration: 25 * 60,
      remaining: 25 * 60,
      status: 'idle',
      mode: 'focus',
      taskId: undefined,
      history: [],
      setMode: usePomodoroStore.getState().setMode,
      start: usePomodoroStore.getState().start,
      pause: usePomodoroStore.getState().pause,
      reset: usePomodoroStore.getState().reset,
      tick: usePomodoroStore.getState().tick,
      setTask: usePomodoroStore.getState().setTask,
      setHistory: usePomodoroStore.getState().setHistory,
      addSession: usePomodoroStore.getState().addSession
    });
  });

  it('starts, ticks, pauses and resets', () => {
    const { start, tick, pause, reset, remaining } = usePomodoroStore.getState();
    start();
    expect(usePomodoroStore.getState().status).toBe('running');
    act(() => {
      tick();
    });
    expect(usePomodoroStore.getState().remaining).toBe(remaining - 1);
    pause();
    expect(usePomodoroStore.getState().status).toBe('paused');
    reset();
    expect(usePomodoroStore.getState().remaining).toBe(usePomodoroStore.getState().duration);
    expect(usePomodoroStore.getState().status).toBe('idle');
  });

  it('changes presets', () => {
    const { setMode } = usePomodoroStore.getState();
    setMode('focus', 25 * 60);
    expect(usePomodoroStore.getState().duration).toBe(25 * 60);
    setMode('short-break', 10 * 60);
    expect(usePomodoroStore.getState().duration).toBe(10 * 60);
    setMode('custom', 15 * 60);
    expect(usePomodoroStore.getState().duration).toBe(15 * 60);
  });

  it('records history via addSession', () => {
    const { addSession, setHistory } = usePomodoroStore.getState();
    setHistory([]);
    addSession({ id: '1', started_at: new Date().toISOString(), duration: 25, task_id: undefined });
    expect(usePomodoroStore.getState().history.length).toBe(1);
  });
});
