import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  User, 
  Send,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  WifiOff
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { login, register, sendOtp, verifyOtp } from '../api';
import { getUsersLocal } from '../lib/localDB';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUserSession } = useRole();

  // Mode: 'login' | 'register' | 'otp_verify'
  const [authMode, setAuthMode] = useState('login');
  
  // Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('mch_saved_email') || '');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [rememberMe, setRememberMe] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [requiresPin2FA, setRequiresPin2FA] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // Si ya tiene sesión activa previa y token, redirigir automáticamente
  useEffect(() => {
    const token = localStorage.getItem('session_token');
    const uData = localStorage.getItem('mch_user_data');
    if (token && uData) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // 1. INICIAR SESIÓN (Gmail / Usuario + PIN opcional o Directo con Gmail)
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = (email || username).trim();
    const cleanPin = pin.trim();

    if (!cleanInput) {
      setError('Por favor ingresá tu correo electrónico o nombre de usuario');
      return;
    }

    // --- MANEJO OFFLINE TRANSPARENTE ---
    // Si no hay conexión o falla la red, validar credenciales localmente con IndexedDB
    if (!navigator.onLine) {
      if (!cleanPin) {
        setError('Estás sin conexión a internet. Ingresá tu PIN para acceder en modo local.');
        return;
      }
      setLoading(true);
      try {
        const localUsers = await getUsersLocal();
        const foundUser = localUsers.find(u => 
          (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === cleanInput.toLowerCase())
        );

        if (foundUser && String(foundUser.pin).trim() === cleanPin) {
          const offlineToken = 'offline_token_' + Date.now();
          setUserSession(foundUser, offlineToken);
          setSuccessMsg('¡Sesión local iniciada (Modo Offline)!');
          setTimeout(() => navigate('/', { replace: true }), 300);
          return;
        } else {
          setError('Credenciales locales no válidas o usuario no sincronizado previamente.');
          return;
        }
      } catch (errLocal) {
        setError('Error al consultar usuarios locales: ' + errLocal.message);
        return;
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      if (rememberMe && cleanInput.includes('@')) {
        localStorage.setItem('mch_saved_email', cleanInput);
      }

      // Si el usuario ingresó un PIN, intenta login directo
      if (cleanPin) {
        let res;
        try {
          res = await login(cleanInput, cleanPin);
        } catch (netErr) {
          // Si el servidor no responde (caída de red imprevista), fallback a autenticación local
          const isNetworkError = !netErr.response || netErr.code === 'ERR_NETWORK' || netErr.message.includes('Network');
          if (isNetworkError) {
            const localUsers = await getUsersLocal();
            const foundUser = localUsers.find(u => 
              (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) ||
              (u.username && u.username.toLowerCase() === cleanInput.toLowerCase())
            );
            if (foundUser && String(foundUser.pin).trim() === cleanPin) {
              const offlineToken = 'offline_token_' + Date.now();
              setUserSession(foundUser, offlineToken);
              setSuccessMsg('Conexión no disponible: Entrando en modo local...');
              setTimeout(() => navigate('/', { replace: true }), 300);
              return;
            }
          }
          throw netErr;
        }
        
        if (res.requiresOtp) {
          // Si es sospechoso o tiene 2FA activado, envía el código y pide verificar
          setEmail(res.email || cleanInput);
          setAuthMode('otp_verify');
          setRequiresPin2FA(true);
          setSuccessMsg(res.message || 'Código OTP enviado a tu Gmail');
          setCountdown(60);
          return;
        }

        if (res.success && res.token) {
          setUserSession(res.user, res.token);
          setSuccessMsg('¡Bienvenido! Entrando al sistema...');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 400);
          return;
        }
      } else {
        // Login sin PIN (Verificación por Código OTP a Gmail)
        const res = await sendOtp(cleanInput);
        setEmail(res.email || cleanInput);
        setSuccessMsg(`¡Código de acceso enviado a ${res.email || cleanInput}! Revisá tu bandeja.`);
        setAuthMode('otp_verify');
        setRequiresPin2FA(!!res.requiresPin);
        setCountdown(60);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // 2. CREAR CUENTA NUEVA (Registro)
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPin = pin.trim();

    if (!cleanUsername || !cleanEmail || !cleanPin) {
      setError('Por favor completá todos los campos para crear tu cuenta');
      return;
    }

    if (cleanPin.length < 4) {
      setError('El PIN o contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (cleanPin !== confirmPin.trim()) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('mch_saved_email', cleanEmail);
      }

      const res = await register(cleanUsername, cleanEmail, cleanPin);
      if (res.success) {
        setSuccessMsg(`¡Cuenta creada! Enviamos un código de seguridad a ${cleanEmail}`);
        setAuthMode('otp_verify');
        setRequiresPin2FA(false);
        setCountdown(60);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  // 3. REENVIAR CÓDIGO OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Correo no especificado');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(cleanEmail);
      setSuccessMsg(`Nuevo código enviado a ${res.email || cleanEmail}`);
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al reenviar código');
    } finally {
      setLoading(false);
    }
  };

  // 4. VERIFICAR CÓDIGO Y ENTRAR
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length < 4) {
      setError('Ingresá el código de 6 dígitos que recibiste en tu Gmail');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(cleanEmail, cleanCode, pin.trim());
      if (res.success && res.token) {
        setUserSession(res.user, res.token);
        setSuccessMsg('¡Acceso verificado con éxito! Entrando...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresPin) {
        setRequiresPin2FA(true);
        setError('Esta cuenta tiene Doble Factor activado. Ingresá tu PIN.');
      } else {
        setError(data?.error || 'Código incorrecto o expirado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#090d16] relative overflow-hidden text-slate-100 font-sans select-none">
      {/* Background Animated Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md z-10 relative"
      >
        {/* Card Container */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
          {/* Top highlight bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500" />

          {/* Logo / Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 mb-2 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Miss Chulerías <span className="bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent">CRM</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {authMode === 'register' 
                ? 'Crear una nueva cuenta de usuario' 
                : authMode === 'otp_verify' 
                  ? 'Verificación de seguridad en dos pasos' 
                  : 'Ingresá a tu cuenta de gestión'}
            </p>
          </div>

          {/* Tabs: Iniciar Sesión / Crear Cuenta */}
          {authMode !== 'otp_verify' && (
            <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'login' 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Iniciar Sesión</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'register' 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Crear Cuenta</span>
              </button>
            </div>
          )}

          {/* Alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. FORMULARIO DE INICIAR SESIÓN */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Correo Gmail o Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yoelbritomachado@gmail.com"
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    PIN / Contraseña (Opcional)
                  </label>
                  <span className="text-[10px] text-cyan-400 font-medium">
                    Dejalo vacío para entrar solo con código de Gmail
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPin ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-11 pr-11 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-400 w-4 h-4"
                  />
                  <span>Recordar sesión en este equipo</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <span>{pin ? 'Iniciar Sesión' : 'Continuar con Gmail'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. FORMULARIO DE CREAR CUENTA NUEVA */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Nombre de Usuario / Alias
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Yoel Brito"
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Correo Electrónico (Gmail)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.correo@gmail.com"
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-1">
                  Te enviaremos el código de activación a este correo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                    PIN / Clave
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white text-center font-mono placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                    Confirmar
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3 py-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white text-center font-mono placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creando cuenta y enviando código...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Crear Cuenta y Recibir Código</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORMULARIO DE VERIFICACIÓN DE CÓDIGO OTP */}
          {authMode === 'otp_verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center pb-1">
                <p className="text-xs text-slate-400">
                  Código de verificación enviado a:
                </p>
                <p className="text-xs font-bold text-cyan-400 truncate mt-0.5">{email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider text-center">
                  Código de 6 Dígitos
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full py-3 text-center text-2xl font-mono font-black tracking-[0.5em] bg-slate-950/60 border border-slate-700/80 rounded-xl text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Solo si la cuenta tiene 2FA (PIN) previamente activado */}
              {requiresPin2FA && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    PIN de Seguridad (Requerido por Doble Factor)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Ingresá tu PIN de 2FA"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length < 4}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Verificar y Entrar</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Volver al Login
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 transition-colors font-medium"
                >
                  {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar Código'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          Miss Chulerías CRM • Sistema Multi-Sede Almacén & Kioscos
        </p>
      </motion.div>
    </div>
  );
}
