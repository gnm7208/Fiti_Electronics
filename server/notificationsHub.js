import { EventEmitter } from 'events';

// In-process pub/sub so the admin dashboard's SSE stream can be notified the
// instant an order/query/stock event happens elsewhere in the request cycle,
// without polling.
const emitter = new EventEmitter();
const EVENT_NAME = 'notification';

export function publishNotification(notification) {
    emitter.emit(EVENT_NAME, notification);
}

export function subscribeToNotifications(listener) {
    emitter.on(EVENT_NAME, listener);
    return () => emitter.off(EVENT_NAME, listener);
}
