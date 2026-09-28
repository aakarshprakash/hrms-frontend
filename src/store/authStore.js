import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Session state. `company` is the organisation (tenant) the user belongs to;
 * `features` are the modules its plan includes. A platform admin has no
 * company of their own and may enter one in "support mode"
 * (supportCompanyId), which the API client sends as X-Company-Id.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      company: null,
      features: [],
      subscription: null,
      activeBranchId: null,
      activeBranch: null,
      branches: [],
      supportCompanyId: null,

      setAuth: (user, token, branches = [], extra = {}) => {
        // Start in the user's own branch when they have one.
        const home = branches.find((b) => b.id === user?.branch_id) ?? branches[0] ?? null
        set({
          user,
          token,
          branches,
          company: extra.company ?? null,
          features: extra.features ?? [],
          subscription: extra.subscription ?? null,
          supportCompanyId: null,
          activeBranchId: home?.id ?? null,
          activeBranch: home,
        })
      },

      /** Refresh everything except the token (after /auth/me or entering support mode). */
      setSession: (payload) =>
        set((state) => {
          const branches = payload.branches ?? []
          const keep = branches.find((b) => b.id === state.activeBranchId)
            ?? branches.find((b) => b.id === (payload.user ?? state.user)?.branch_id)
          return {
            user: payload.user ?? state.user,
            company: payload.company ?? null,
            features: payload.features ?? [],
            subscription: payload.subscription ?? null,
            branches,
            activeBranchId: keep?.id ?? branches[0]?.id ?? null,
            activeBranch: keep ?? branches[0] ?? null,
          }
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

      setUser: (user) => set({ user }),

      enterSupportMode: (companyId) => set({ supportCompanyId: companyId, branches: [], activeBranchId: null, activeBranch: null }),
      exitSupportMode: () => set({ supportCompanyId: null, company: null, branches: [], activeBranchId: null, activeBranch: null, features: [] }),

      logout: () => set({
        user: null, token: null, company: null, features: [], subscription: null,
        activeBranchId: null, activeBranch: null, branches: [], supportCompanyId: null,
      }),
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
