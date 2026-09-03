import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, KeyRound, Shield, X, Check, RefreshCw, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { useRole } from '../hooks/useRole';
import ImagePickerWithCamera from './ImagePickerWithCamera';
import api from '../api';

export default function ProfileModal({ isOpen, onClose, onUpdated }) {
  const { user, role, isOwner, isAdmin } = useRole();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled === 1 || user?.two_factor_enabled === true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPin && newPin !== confirmPin) {
      setError('Los nuevos PINs no coinciden');
      return;
    }

    if (newPin && (newPin.length < 4 || newPin.length > 6)) {
      setError('El PIN debe tener entre 4 y 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        avatar_url: avatarUrl,
        two_factor_enabled: twoFactorEnabled
      };
      if (newPin) {
        payload.pin = newPin;
        payload.current_pin = currentPin;
      }

      const res = await api.patch('/users/profile/me', payload);
      if (res.data && res.data.user) {
        setSuccess('¡Perfil actualizado correctamente!');
        if (onUpdated) onUpdated(res.data.user);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = isOwner ? 'Dueño' : isAdmin ? 'Administrador' : 'Vendedor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mi Perfil</h2>
              <p className="text-xs text-slate-400">Personalizá tu foto, PIN y Doble Factor</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveProfile} className="p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Info básica no editable */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Usuario Asignado</p>
              <p className="text-sm font-bold text-white">{user?.username || user?.email || 'Yoel Brito'}</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              {roleLabel}
            </span>
          </div>

          {/* Foto de perfil */}
          <ImagePickerWithCamera
            label="Mi Foto de Perfil"
            subLabel="Visible en el sistema y tus ventas"
            value={avatarUrl}
            type="avatar"
            aspectRatio="square"
            onChange={(url) => setAvatarUrl(url)}
            onRemove={() => setAvatarUrl('')}
          />

          {/* Doble Factor (2FA) */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center border",
                twoFactorEnabled 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-slate-800 border-slate-700 text-slate-400"
              )}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Doble Factor de Autenticación (2FA)</p>
                <p className="text-[11px] text-slate-400">Exigir código OTP por Gmail al iniciar con PIN</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                twoFactorEnabled ? "bg-cyan-500" : "bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  twoFactorEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Cambio de PIN / Clave */}
          <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Actualizar PIN de Acceso
            </h4>
            <p className="text-[11px] text-slate-400 leading-tight">
              Dejá estos campos en blanco si no querés cambiar tu PIN actual.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nuevo PIN (4-6 núm)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Confirmar PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar Perfil</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
