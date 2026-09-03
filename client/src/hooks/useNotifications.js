import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef(null);
  const retryCountRef = useRef(0);

  // Fetch notifications with error handling
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
      setIsOnline(true);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (e) {
      // Silently handle network errors - don't spam console
      if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
        setIsOnline(false);
        // Only log first error, then silently fail
        if (retryCountRef.current === 0) {
          console.log('Backend no disponible - notificaciones offline');
        }
        retryCountRef.current++;
      } else {
        setError(e.response?.data?.error || 'Error al cargar notificaciones');
        console.error('Error fetching notifications:', e);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!isOnline) return; // Skip if offline
    
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // Silently ignore network errors
      if (e.code !== 'ERR_NETWORK') {
        console.error('Error marking notification as read:', e);
      }
    }
  }, [isOnline]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!isOnline) return; // Skip if offline
    
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      // Silently ignore network errors
      if (e.code !== 'ERR_NETWORK') {
        console.error('Error marking all notifications as read:', e);
      }
    }
  }, [isOnline]);

  // Initial fetch and polling setup
  useEffect(() => {
    // Initial fetch
    fetchNotifications();
    
    // Set up polling every 30 seconds only if online
    intervalRef.current = setInterval(() => {
      if (isOnline || retryCountRef.current < 3) {
        fetchNotifications(true); // Silent fetch (no loading state)
      }
    }, 30000);
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      retryCountRef.current = 0;
      fetchNotifications();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchNotifications, isOnline]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isOnline,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}
