import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      activeBranchId: null,
      activeBranch: null,
      branches: [],

      setAuth: (user, token, branches = []) =>
        set({
          user,
          token,
          branches,
          activeBranchId: branches[0]?.id ?? null,
          activeBranch: branches[0] ?? null,
        }),
      setActiveBranch: (branchId) =>
        set((state) => ({
          activeBranchId: branchId,
          activeBranch: state.branches.find((b) => b.id === branchId) ?? null,
        })),
      setBranches: (branches) =>
        set((state) => ({
          branches,
          activeBranch: branches.find((b) => b.id === state.activeBranchId) ?? branches[0] ?? null,
        })),
      logout: () => set({ user: null, token: null, activeBranchId: null, activeBranch: null, branches: [] }),
    }),
    {
      name: 'hrms-auth',
      // Sessions persisted before `activeBranch` existed on this store
      // rehydrate straight from localStorage without going through
      // setAuth/setActiveBranch, so they'd otherwise be stuck with
      // activeBranch: undefined until a fresh login. Backfill it on merge,
      // which (unlike onRehydrateStorage) runs synchronously and reliably
      // produces the actual hydrated state.
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...persistedState }
        if (!merged.activeBranch && merged.branches?.length) {
          merged.activeBranch = merged.branches.find((b) => b.id === merged.activeBranchId) ?? merged.branches[0] ?? null
        }
        return merged
      },
    }
  )
)
