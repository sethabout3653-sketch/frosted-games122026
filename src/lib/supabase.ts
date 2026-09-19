/// <reference types="vite/client" />
// ============================================================================
// Zero-Quota Self-Contained Compatibility Shim for Supabase
// Routes all operations through the Unlimited Free Database Engine (Vercel Ready)
// ============================================================================

import { universalDB, storageEngine } from './database';

export const SUPABASE_URL = 'http://localhost/api/db';
export const SUPABASE_ANON_KEY = 'universal_zero_quota_key';

export const supabase = {
  from: (tableName: string) => ({
    select: async (_cols?: string) => {
      const items = await universalDB.fetchCollection(tableName);
      return { data: items.map(d => ({ ...d, data: d })), error: null };
    },
    insert: async (data: any) => {
      const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await universalDB.write("set", tableName, id, data);
      return { data, error: null };
    },
    upsert: async (data: any) => {
      const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await universalDB.write("set", tableName, id, data);
      return { data, error: null };
    },
    update: (data: any) => ({
      eq: async (field: string, val: any) => {
        if (field === 'id') {
          await universalDB.write("update", tableName, val, data);
        }
        return { data, error: null };
      },
    }),
    delete: () => ({
      eq: async (field: string, val: any) => {
        if (field === 'id') {
          await universalDB.write("delete", tableName, val);
        }
        return { error: null };
      },
    }),
  }),
  storage: {
    from: (_bucketName: string) => ({
      upload: async (_path: string, file: File) => {
        const res = await storageEngine.upload(file);
        return { data: { path: res.url }, error: null };
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: path },
      }),
    }),
  },
  channel: (name: string) => ({
    on: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
      subscribe: () => ({}),
    }),
    send: () => {},
    subscribe: () => ({}),
  }),
  removeChannel: () => {},
};
