import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  eventBus?: EventEmitter;
};

export const eventBus =
  globalForEvents.eventBus ?? (globalForEvents.eventBus = new EventEmitter());
