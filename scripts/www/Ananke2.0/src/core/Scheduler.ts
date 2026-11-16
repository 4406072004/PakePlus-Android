/**
 * Scheduler & EventEngine: 统一延时与未来事件调度系统
 * 避免为每个功能建立大量永久 setInterval
 */

import { ScheduledEvent } from '../types';
import { StorageService } from '../services/StorageService';

export type EventHandler = (event: ScheduledEvent) => void;

export class Scheduler {
  private events: ScheduledEvent[] = [];
  private handlers: Map<string, EventHandler[]> = new Map();
  private timerId: number | null = null;

  constructor(initialEvents?: ScheduledEvent[]) {
    try {
      const persisted = StorageService.getScheduledEvents();
      this.events = initialEvents && initialEvents.length > 0 ? [...initialEvents] : (Array.isArray(persisted) ? [...persisted] : []);
    } catch {
      this.events = initialEvents ? [...initialEvents] : [];
    }
  }

  public getEvents(): ScheduledEvent[] {
    return [...this.events];
  }

  public getPendingEvents(): ScheduledEvent[] {
    return this.events.filter(e => e.status === 'pending');
  }

  private persist(): void {
    try {
      const pending = this.events.filter(e => e.status === 'pending');
      StorageService.saveScheduledEvents(pending);
    } catch {
      // ignore
    }
  }

  /**
   * 注册指定类型事件的处理器
   */
  public subscribe(type: string, handler: EventHandler): () => void {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);

    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  /**
   * 添加一个未来事件
   */
  public schedule(type: ScheduledEvent['type'], delayMs: number, payload: Record<string, unknown> = {}): ScheduledEvent {
    const event: ScheduledEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type,
      executeAt: Date.now() + Math.max(0, delayMs),
      payload,
      status: 'pending',
    };
    this.events.push(event);
    this.persist();
    return event;
  }

  /**
   * 立即强制触发某个未执行事件（便于调试与立即交付）
   */
  public triggerNow(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (event && event.status === 'pending') {
      event.executeAt = Date.now();
      this.tick();
      return true;
    }
    return false;
  }

  /**
   * 取消未执行事件
   */
  public cancel(eventId: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (event && event.status === 'pending') {
      event.status = 'cancelled';
      this.persist();
    }
  }

  /**
   * 检查并分发到期的事件
   */
  public tick(now: number = Date.now()): ScheduledEvent[] {
    const executed: ScheduledEvent[] = [];
    let stateChanged = false;

    for (const event of this.events) {
      if (event.status === 'pending' && now >= event.executeAt) {
        event.status = 'executed';
        executed.push(event);
        stateChanged = true;

        const handlers = this.handlers.get(event.type);
        if (handlers) {
          handlers.forEach(h => {
            try {
              h(event);
            } catch (err) {
              console.error(`Error executing event ${event.id}:`, err);
            }
          });
        }
      }
    }
    // 清理较早完成的事件保持内存轻量
    if (this.events.length > 200) {
      this.events = this.events.filter(e => e.status === 'pending' || (now - e.executeAt < 86400000));
      stateChanged = true;
    }

    if (stateChanged) {
      this.persist();
    }

    return executed;
  }

  /**
   * 启动全局心跳检查（单一定时器）
   */
  public start(intervalMs: number = 3000): void {
    if (this.timerId !== null) return;
    this.timerId = window.setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  /**
   * 停止全局心跳
   */
  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

// 全局单例调度器
export const globalScheduler = new Scheduler();
