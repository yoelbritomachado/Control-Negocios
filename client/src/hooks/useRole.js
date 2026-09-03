import React, { useState, useEffect, useCallback } from 'react';

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
    const userRole = localStorage.getItem('mch_user_role');
    return userRole || saved || ROLES.OWNER.id; // Por defecto Owner/Admin
  });

  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem('mch_current_user_name');
    return saved || 'Yoel Brito';
  });

  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('mch_user_email') || '';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('mch_user_data');
      return u ? JSON.parse(u) : null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    const handleSyncRole = () => {
      try {
        const u = localStorage.getItem('mch_user_data');
        if (u) {
          const parsed = JSON.parse(u);
          setCurrentUser(parsed);
          if (parsed.role) {
            const roleMapping = {
              'owner': ROLES.OWNER.id,
              'dueño': ROLES.OWNER.id,
              'dueno': ROLES.OWNER.id,
              'admin': ROLES.ADMIN.id,
              'administrador': ROLES.ADMIN.id,
              'seller': ROLES.SELLER.id,
              'vendedor': ROLES.SELLER.id
            };
            const mapped = roleMapping[parsed.role.toLowerCase()];
            if (mapped) setCurrentRole(mapped);
          }
          if (parsed.username) setUserName(parsed.username);
          if (parsed.email) setUserEmail(parsed.email);
        } else {
          const savedRole = localStorage.getItem('mch_current_role') || localStorage.getItem('mch_user_role');
          const savedName = localStorage.getItem('mch_current_user_name');
          if (savedRole) setCurrentRole(savedRole);
          if (savedName) setUserName(savedName);
        }
      } catch (_) {}
    };

    window.addEventListener('storage', handleSyncRole);
    window.addEventListener('mch-role-changed', handleSyncRole);

    // Al montar, sincronizar inmediatamente con el usuario autenticado real
    handleSyncRole();

    return () => {
      window.removeEventListener('storage', handleSyncRole);
      window.removeEventListener('mch-role-changed', handleSyncRole);
    };
  }, []);

  const changeRole = useCallback((roleId, name) => {
    if (ROLES[roleId.toUpperCase()]) {
      setCurrentRole(roleId);
      localStorage.setItem('mch_current_role', roleId);
      localStorage.setItem('mch_user_role', roleId);
      
      if (name) {
        setUserName(name);
        localStorage.setItem('mch_current_user_name', name);
      }
      
      // Recargar para aplicar cambios
      window.location.reload();
    }
  }, []);

  const setUserSession = useCallback((userData, token) => {
    if (token) localStorage.setItem('session_token', token);
    if (userData) {
      localStorage.setItem('mch_user_data', JSON.stringify(userData));
      localStorage.setItem('mch_user_email', userData.email || '');
      localStorage.setItem('mch_current_user_name', userData.username || userData.email || 'Usuario');
      const normalizedRole = (userData.role === 'owner' || userData.role === 'admin') ? userData.role : 'seller';
      localStorage.setItem('mch_user_role', normalizedRole);
      localStorage.setItem('mch_current_role', normalizedRole);
      setCurrentUser(userData);
      setUserName(userData.username || userData.email || 'Usuario');
      setUserEmail(userData.email || '');
      setCurrentRole(normalizedRole);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('session_token');
    localStorage.removeItem('mch_user_data');
    localStorage.removeItem('mch_user_email');
    localStorage.removeItem('mch_user_role');
    localStorage.removeItem('mch_current_role');
    localStorage.removeItem('mch_current_user_name');
    window.location.href = '/login';
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
    userEmail,
    user: currentUser,
    currentUser,
    setUserSession,
    logout,
    changeRole,
    getRoleInfo,
    isOwner,
    isAdmin,
    isSeller,
    ROLES
  };
}
