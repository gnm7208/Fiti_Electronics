import { randomUUID } from 'crypto';

/** Thin wrapper around json-server's lowdb instance for the "queries" collection. */
export function createQueriesStore(db) {
    function create(record) {
        const query = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            ...record,
        };
        db.get('queries').push(query).write();
        return query;
    }

    return { create };
}
