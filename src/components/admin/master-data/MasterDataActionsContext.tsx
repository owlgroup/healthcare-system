import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AddAction = {
  label: string;
  onAdd: () => void;
};

type MasterDataActionsContextValue = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  registerAddAction: (tab: string, action: AddAction | null) => void;
  currentAddAction: AddAction | null;
  tabCounts: Record<string, number>;
  setTabCount: (tab: string, count: number) => void;
};

const MasterDataActionsContext = createContext<MasterDataActionsContextValue | null>(null);

export function MasterDataActionsProvider({
  children,
  defaultTab = 'specialties',
}: {
  children: ReactNode;
  defaultTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [addActions, setAddActions] = useState<Record<string, AddAction>>({});

  const registerAddAction = useCallback((tab: string, action: AddAction | null) => {
    setAddActions((prev) => {
      if (!action) {
        const next = { ...prev };
        delete next[tab];
        return next;
      }
      return { ...prev, [tab]: action };
    });
  }, []);

  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  const setTabCount = useCallback((tab: string, count: number) => {
    setTabCounts((prev) => (prev[tab] === count ? prev : { ...prev, [tab]: count }));
  }, []);

  const currentAddAction = addActions[activeTab] ?? null;

  const value = useMemo(
    () => ({ activeTab, setActiveTab, registerAddAction, currentAddAction, tabCounts, setTabCount }),
    [activeTab, registerAddAction, currentAddAction, tabCounts, setTabCount],
  );

  return (
    <MasterDataActionsContext.Provider value={value}>
      {children}
    </MasterDataActionsContext.Provider>
  );
}

export function useMasterDataActions() {
  const ctx = useContext(MasterDataActionsContext);
  if (!ctx) throw new Error('useMasterDataActions must be used within MasterDataActionsProvider');
  return ctx;
}

/** Same as useMasterDataActions but returns null outside the provider */
export function useOptionalMasterDataActions() {
  return useContext(MasterDataActionsContext);
}

/** Register add action for a tab; cleans up on unmount */
export function useRegisterAddAction(tab: string, label: string, onAdd: () => void) {
  const { registerAddAction } = useMasterDataActions();

  useEffect(() => {
    registerAddAction(tab, { label, onAdd });
    return () => registerAddAction(tab, null);
  }, [tab, label, onAdd, registerAddAction]);
}
