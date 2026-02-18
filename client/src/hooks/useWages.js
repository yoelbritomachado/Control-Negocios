import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export function useWages() {
  const [wageSummary, setWageSummary] = useState({
    sessions: [],
    summary: {
      total_earned: 0,
      total_paid: 0,
      pending_amount: 0,
      pending_requests: 0
    }
  });
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch wage summary for current seller
  const fetchWageSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/wages/my-summary');
      setWageSummary(res.data);
    } catch (e) {
      console.error('Error fetching wage summary:', e);
      setError(e.response?.data?.error || 'Error al cargar resumen de salario');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pending payments (for admin)
  const fetchPendingPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/wages/pending');
      setPendingPayments(res.data.payments || []);
    } catch (e) {
      console.error('Error fetching pending payments:', e);
      setError(e.response?.data?.error || 'Error al cargar pagos pendientes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Request wage payment for a session
  const requestPayment = useCallback(async (sessionId, amount, paymentMethod = 'cash') => {
    try {
      const res = await api.post('/wages/request', {
        session_id: sessionId,
        amount,
        payment_method: paymentMethod
      });
      await fetchWageSummary(); // Refresh summary
      return { success: true, data: res.data };
    } catch (e) {
      console.error('Error requesting payment:', e);
      return { 
        success: false, 
        error: e.response?.data?.error || 'Error al solicitar pago' 
      };
    }
  }, [fetchWageSummary]);

  // Process wage payment (admin only)
  const processPayment = useCallback(async (paymentId, notes = '') => {
    try {
      const res = await api.post(`/wages/${paymentId}/pay`, { notes });
      await fetchPendingPayments(); // Refresh pending list
      return { success: true, data: res.data };
    } catch (e) {
      console.error('Error processing payment:', e);
      return { 
        success: false, 
        error: e.response?.data?.error || 'Error al procesar pago' 
      };
    }
  }, [fetchPendingPayments]);

  // Initial fetch
  useEffect(() => {
    fetchWageSummary();
  }, [fetchWageSummary]);

  return {
    wageSummary,
    pendingPayments,
    loading,
    error,
    fetchWageSummary,
    fetchPendingPayments,
    requestPayment,
    processPayment
  };
}
