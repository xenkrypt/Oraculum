// ─── Backward-Compatibility Shim ─────────────────────────────────────────────
// All legacy routes that imported from mockDb.ts are redirected to store.ts.
// This ensures a single source of truth without breaking existing imports.

export {
  getStore as getMockDb,
  saveStore as saveMockDb,
  generateId,
  type Store as MockDb
} from "@/lib/store";
