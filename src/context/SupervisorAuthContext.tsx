import React, { createContext, useContext, useState, useEffect } from 'react';

export interface TabPermissions {
  online: boolean;      // Quick Submitter
  whatsapp: boolean;    // WhatsApp Bot
  crew: boolean;        // Crew Roster
  emailPdf: boolean;    // PDF & Email
  simulator: boolean;   // Live Inspector
  mass: boolean;        // Mass Submitter 1000s (default supervisor only)
  operations: boolean;  // Operations PDF Synthesizer (default supervisor only)
  scripts: boolean;     // Automation Scripts (default supervisor only)
}

interface SupervisorAuthContextType {
  isSupervisor: boolean;
  loginModalOpen: boolean;
  settingsModalOpen: boolean;
  portalLockedDown: boolean;
  supervisorNumber: string;
  tabPermissions: TabPermissions;
  openLoginModal: (targetTab?: string) => void;
  closeLoginModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  loginWithNumberOrPin: (input: string) => boolean;
  logoutSupervisor: () => void;
  updateSupervisorNumber: (newNumber: string) => void;
  setPortalLockedDown: (locked: boolean) => void;
  toggleTabPermission: (tabKey: keyof TabPermissions, value: boolean) => void;
  resetPermissionsToDefault: () => void;
}

const SupervisorAuthContext = createContext<SupervisorAuthContextType | undefined>(undefined);

const STORAGE_AUTH = 'rig50_supervisor_auth';
const STORAGE_NUMBER = 'rig50_supervisor_phone_or_pin';
const STORAGE_PORTAL_LOCK = 'rig50_portal_lockdown';
const STORAGE_PERMISSIONS = 'rig50_tab_permissions';

const DEFAULT_PERMISSIONS: TabPermissions = {
  online: true,
  whatsapp: true,
  crew: true,
  emailPdf: false,
  simulator: true,
  mass: false,         // Never visible to crew
  operations: false,   // Never visible to crew
  scripts: false       // Never visible to crew
};

export const SupervisorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSupervisor, setIsSupervisor] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_AUTH) === 'true';
  });

  const [supervisorNumber, setSupervisorNumber] = useState<string>(() => {
    return localStorage.getItem(STORAGE_NUMBER) || '5050';
  });

  const [portalLockedDown, setPortalLockedDownState] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_PORTAL_LOCK) === 'true';
  });

  const [tabPermissions, setTabPermissions] = useState<TabPermissions>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PERMISSIONS);
      if (stored) {
        return { ...DEFAULT_PERMISSIONS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to parse tab permissions:', e);
    }
    return DEFAULT_PERMISSIONS;
  });

  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_AUTH, String(isSupervisor));
  }, [isSupervisor]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PORTAL_LOCK, String(portalLockedDown));
  }, [portalLockedDown]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PERMISSIONS, JSON.stringify(tabPermissions));
  }, [tabPermissions]);

  // Sync settings with the backend server on startup
  useEffect(() => {
    fetch('/api/supervisor/settings')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.supervisorNumber === 'string' && data.supervisorNumber.trim()) {
          setSupervisorNumber(data.supervisorNumber.trim());
          localStorage.setItem(STORAGE_NUMBER, data.supervisorNumber.trim());
        }
        if (data && typeof data.portalLockedDown === 'boolean') {
          setPortalLockedDownState(data.portalLockedDown);
          localStorage.setItem(STORAGE_PORTAL_LOCK, String(data.portalLockedDown));
        }
        if (data && data.tabPermissions && typeof data.tabPermissions === 'object') {
          setTabPermissions(prev => ({ ...prev, ...data.tabPermissions }));
          localStorage.setItem(STORAGE_PERMISSIONS, JSON.stringify(data.tabPermissions));
        }
      })
      .catch(err => {
        console.warn('Could not sync supervisor settings from server, using local store:', err);
      });
  }, []);

  const openLoginModal = (_targetTab?: string) => setLoginModalOpen(true);
  const closeLoginModal = () => setLoginModalOpen(false);

  const openSettingsModal = () => setSettingsModalOpen(true);
  const closeSettingsModal = () => setSettingsModalOpen(false);

  const loginWithNumberOrPin = (input: string): boolean => {
    const clean = input.trim().replace(/\s+/g, '');
    const cleanSaved = supervisorNumber.trim().replace(/\s+/g, '');
    
    // STRICT AUTHENTICATION:
    // Only the exact configured password/PIN is accepted. No rogue hardcoded backdoors!
    const isMatch = clean === cleanSaved;

    if (isMatch) {
      setIsSupervisor(true);
      setLoginModalOpen(false);
      localStorage.setItem(STORAGE_AUTH, 'true');

      // Also notify server in background
      fetch('/api/supervisor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: clean })
      }).catch(() => {});

      return true;
    }
    return false;
  };

  const logoutSupervisor = () => {
    setIsSupervisor(false);
    localStorage.setItem(STORAGE_AUTH, 'false');
    localStorage.removeItem(STORAGE_AUTH);
  };

  const updateSupervisorNumber = (newNumber: string) => {
    const clean = newNumber.trim();
    if (clean.length >= 2) {
      setSupervisorNumber(clean);
      localStorage.setItem(STORAGE_NUMBER, clean);

      // Persist permanently to server disk & memory
      fetch('/api/supervisor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorNumber: clean })
      }).catch(err => console.warn('Could not save supervisor number to server:', err));
    }
  };

  const setPortalLockedDown = (locked: boolean) => {
    setPortalLockedDownState(locked);
    fetch('/api/supervisor/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalLockedDown: locked })
    }).catch(() => {});
  };

  const toggleTabPermission = (tabKey: keyof TabPermissions, value: boolean) => {
    const updated = {
      ...tabPermissions,
      [tabKey]: value
    };
    setTabPermissions(updated);
    fetch('/api/supervisor/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabPermissions: updated })
    }).catch(() => {});
  };

  const resetPermissionsToDefault = () => {
    setTabPermissions(DEFAULT_PERMISSIONS);
    fetch('/api/supervisor/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabPermissions: DEFAULT_PERMISSIONS })
    }).catch(() => {});
  };

  return (
    <SupervisorAuthContext.Provider
      value={{
        isSupervisor,
        loginModalOpen,
        settingsModalOpen,
        portalLockedDown,
        supervisorNumber,
        tabPermissions,
        openLoginModal,
        closeLoginModal,
        openSettingsModal,
        closeSettingsModal,
        loginWithNumberOrPin,
        logoutSupervisor,
        updateSupervisorNumber,
        setPortalLockedDown,
        toggleTabPermission,
        resetPermissionsToDefault
      }}
    >
      {children}
    </SupervisorAuthContext.Provider>
  );
};

export const useSupervisor = (): SupervisorAuthContextType => {
  const context = useContext(SupervisorAuthContext);
  if (!context) {
    throw new Error('useSupervisor must be used within a SupervisorAuthProvider');
  }
  return context;
};
