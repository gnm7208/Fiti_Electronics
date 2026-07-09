import { randomUUID } from 'crypto';
import { publishNotification } from './notificationsHub.js';

/** Thin wrapper around json-server's lowdb instance for the "notifications" collection. */
export function createNotificationsStore(db) {
    function create({ type, message, meta }) {
        const notification = {
            id: randomUUID(),
            type,
            message,
            meta: meta || null,
            read: false,
            createdAt: new Date().toISOString(),
        };
        db.get('notifications').push(notification).write();
        publishNotification(notification);
        return notification;
    }

    function list() {
        return db.get('notifications').orderBy(['createdAt'], ['desc']).value();
    }

    function markRead(id) {
        db.get('notifications').find({ id }).assign({ read: true }).write();
        return db.get('notifications').find({ id }).value();
    }

    return { create, list, markRead };
}
