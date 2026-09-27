import { pgTable, text, bigint, index, primaryKey } from 'drizzle-orm/pg-core';

export const records = pgTable('records', {
  collection: text('collection').notNull(),
  id: text('id').notNull(),
  data: text('data').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.collection, table.id] }),
    collectionIdx: index('idx_records_collection').on(table.collection),
  };
});

export const webrtcSignals = pgTable('webrtc_signals', {
  id: text('id').primaryKey(),
  targetUid: text('target_uid').notNull(),
  uid: text('uid').notNull(),
  payload: text('payload').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

export const rtcSignals = pgTable('rtc_signals', {
  id: text('id').primaryKey(),
  roomId: text('room_id'),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  payload: text('payload').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});
