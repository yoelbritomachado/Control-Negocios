import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope, FaKey, FaShieldAlt } from 'react-icons/fa';

const Login = ({
  onLogin,
  onSendCode,
  onVerifyCode,
  onRegister,
  onVerifyRegistration,
  isRegistering,
  setIsRegistering,
  isLoginByCode,
  setIsLoginByCode,
  codeSent,
  setCodeSent,
  loginLoading,
  loginError,
  registerForm,
  setRegisterForm,
  isVerifyingRegistration,
  setIsVerifyingRegistration,
  registrationCode,
  setRegistrationCode,
  emailCode,
  setEmailCode,
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword
}) => {

  if (isRegistering) {
    if (isVerifyingRegistration) {
      // REGISTER FLOW: STEP 2 - VERIFY CODE
      return (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
              <FaEnvelope size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Hemos enviado un código de verificación a:
              <br />
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{registerForm.email}</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <FaKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Código de 6 dígitos"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-black text-2xl text-center tracking-[0.5em] text-indigo-600 dark:text-white placeholder-gray-300"
                maxLength={6}
              />
            </div>

            <button
              onClick={onVerifyRegistration}
              disabled={loginLoading || registrationCode.length < 6}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <span className="animate-pulse">Verificando...</span>
              ) : (
                <>
                  <FaCheckCircle className="text-lg" /> Activar Cuenta
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsVerifyingRegistration(false)}
              className="w-full py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-bold text-xs uppercase transition-colors"
            >
              Corregir Correo
            </button>
          </div>
        </div>
      );
    }

    // REGISTER FLOW: STEP 1 - FILL FORM
    return (
      <form onSubmit={onRegister} className="space-y-5 animate-fade-in">
        <div className="space-y-4">
          <div className="relative group">
            <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Nombre de Usuario"
              value={registerForm.username}
              onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-center text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="relative group">
            <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="email"
              placeholder="Correo Electrónico"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-center text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="relative group">
            <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="password"
              placeholder="PIN de 4 dígitos"
              value={registerForm.pin}
              onChange={(e) => setRegisterForm({ ...registerForm, pin: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-black text-center tracking-widest text-gray-900 dark:text-white placeholder-gray-400"
              maxLength={4}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loginLoading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
        >
          {loginLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
        </button>

        <button
          type="button"
          onClick={() => setIsRegistering(false)}
          className="w-full py-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-xs uppercase transition flex items-center justify-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Volver al Login
        </button>
      </form>
    );
  }

  // LOGIN FLOW
  return (
    <div className="animate-fade-in">
      {isLoginByCode ? (
        /* Code Login Form */
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <FaShieldAlt className="text-blue-500 mt-1 shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
              {codeSent
                ? `Hemos enviado un código de acceso temporal a ${loginUsername}`
                : "Te enviaremos un código de acceso seguro a tu correo registrado."}
            </p>
          </div>

          {!codeSent ? (
            <div className="space-y-4">
              <div className="relative group">
                <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400 transition-colors z-10" />
                <input
                  type="text"
                  placeholder="Tu Usuario o Correo"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="glass-input pl-12 text-center font-bold text-gray-700 dark:text-white placeholder-gray-400"
                />
              </div>
              <button
                onClick={onSendCode}
                disabled={loginLoading || !loginUsername}
                className="btn-liquid-3d w-full text-xs uppercase tracking-widest"
              >
                {loginLoading ? 'Enviando...' : 'Enviar Código'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative group">
                <FaKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors z-10" />
                <input
                  type="text"
                  placeholder="Código de acceso"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-2xl text-center font-black tracking-[0.5em] text-indigo-600 dark:text-white placeholder-gray-400"
                  maxLength={6}
                />
              </div>
              <button
                onClick={onLogin}
                disabled={loginLoading || emailCode.length < 6}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all uppercase text-xs tracking-wider"
              >
                {loginLoading ? 'Verificando...' : 'Entrar'}
              </button>
            </div>
          )}

          <button
            onClick={() => { setIsLoginByCode(false); setCodeSent(false); }}
            className="w-full py-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 font-bold text-xs uppercase transition-colors"
          >
            Usar PIN / Contraseña
          </button>
        </div>
      ) : (
        /* Standard PIN Login Form */
        <form onSubmit={onLogin} className="space-y-6">
          {loginError && (
            <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-lg text-xs font-bold text-center animate-shake">
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors z-10" />
              <input
                type="text"
                placeholder="Usuario o Correo"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center font-bold text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            <div className="relative group">
              <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors z-10" />
              <input
                type="password"
                placeholder="PIN / Contraseña"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center font-bold tracking-widest text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all uppercase text-xs tracking-wider flex justify-center items-center"
          >
            {loginLoading ? (
              <span className="animate-pulse">Iniciando...</span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>

          <div className="flex justify-between items-center px-2">
            <button
              type="button"
              onClick={() => setIsLoginByCode(true)}
              className="text-[10px] font-bold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 uppercase transition-colors"
            >
              Olvidé mi PIN
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 uppercase transition-colors"
            >
              Crear Cuenta
            </button>
          </div>
        </form>
      )}
    </div >
  );
};

export default Login;
