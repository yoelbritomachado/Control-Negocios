import { useState, useEffect, useCallback } from 'react';

// Roles disponibles
export const ROLES = {
  OWNER: { id: 'owner', label: 'Dueño', color: 'text-amber-400' },
  ADMIN: { id: 'admin', label: 'Administrador', color: 'text-cyan-400' },
  SELLER: { id: 'seller', label: 'Vendedor', color: 'text-emerald-400' }
};

export function useRole() {
  const [currentRole, setCurrentRole] = useState(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('mch_current_role');
    return saved || ROLES.ADMIN.id; // Por defecto Admin
  });

  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem('mch_current_user_name');
    return saved || 'Usuario';
  });

  const changeRole = useCallback((roleId, name) => {
    if (ROLES[roleId.toUpperCase()]) {
      setCurrentRole(roleId);
      localStorage.setItem('mch_current_role', roleId);
      
      if (name) {
        setUserName(name);
        localStorage.setItem('mch_current_user_name', name);
      }
      
      // Recargar para aplicar cambios
      window.location.reload();
    }
  }, []);

  const getRoleInfo = useCallback(() => {
    return Object.values(ROLES).find(r => r.id === currentRole) || ROLES.ADMIN;
  }, [currentRole]);

  const isOwner = currentRole === ROLES.OWNER.id;
  const isAdmin = currentRole === ROLES.ADMIN.id || currentRole === ROLES.OWNER.id;
  const isSeller = currentRole === ROLES.SELLER.id;

  return {
    currentRole,
    userName,
    changeRole,
    getRoleInfo,
    isOwner,
    isAdmin,
    isSeller,
    ROLES
  };
}
