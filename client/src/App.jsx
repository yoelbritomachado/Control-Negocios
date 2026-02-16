import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { CartProvider } from './components/CartProvider';
import MainLayout from './components/MainLayout';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import PurchaseSection from './components/PurchaseSection';
import Login from './components/Login';
import DashboardPage from './pages/DashboardPage';
import MigrationTool from './components/MigrationTool';
import LegacyHistoryPage from './pages/LegacyHistoryPage';
import HistoryPage from './pages/HistoryPage';
import api from './api';
import './index.css';

function App() {
  // === AUTH STATE ===
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isAuthenticated') === 'true');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoginByCode, setIsLoginByCode] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifyingRegistration, setIsVerifyingRegistration] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', pin: '' });
  const [registrationCode, setRegistrationCode] = useState('');

  // === EFFECTS ===
  useEffect(() => {
    if (isAuthenticated) {
      // Optionally load global settings here
    }
  }, [isAuthenticated]);

  // === HANDLERS ===
  const finishLogin = (data) => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    if (data.token) localStorage.setItem('session_token', data.token);
    if (data.user?.id) localStorage.setItem('user_id', data.user.id);

    const userObj = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      role: data.user.role,
      can_edit: data.user.can_edit
    };
    localStorage.setItem('currentUser', JSON.stringify(userObj));
    setCurrentUser(userObj);
  };

  const handleLogin = async (e) => {
    e && e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      if (isLoginByCode) {
        const res = await api.post('/auth/verify-code', { code: emailCode.trim() });
        if (res.data.success) finishLogin(res.data);
      } else {
        const res = await api.post('/login', {
          username: loginUsername.trim(),
          pin: loginPassword.trim()
        });
        if (res.data.mfaRequired) {
          setIsLoginByCode(true);
          setCodeSent(true);
          alert(res.data.message);
        } else if (res.data.success) {
          finishLogin(res.data);
        }
      }
    } catch (error) {
      console.error("Login Error:", error);
      const data = error.response?.data;
      setLoginError(data?.message || data?.error || 'Error de autenticación');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!loginUsername) return alert("Ingresa tu usuario");
    setLoginLoading(true);
    try {
      const res = await api.post('/auth/send-code', { username: loginUsername.trim() });
      setCodeSent(true);
      alert(res.data.message || 'Código enviado.');
    } catch (e) {
      alert('Error enviando código');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanForm = {
      username: registerForm.username.trim(),
      email: registerForm.email.trim(),
      pin: registerForm.pin.trim()
    };

    if (!cleanForm.username || !cleanForm.email || !cleanForm.pin) return alert('Llena todos los campos');

    try {
      setLoginLoading(true);
      const res = await api.post('/register', cleanForm);

      if (res.data.requireVerification) {
        setIsVerifyingRegistration(true);
        alert(`Código de verificación enviado a ${registerForm.email}.`);
      } else {
        alert('Usuario creado con éxito.');
        setIsRegistering(false);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Error al registrar');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyRegistration = async () => {
    try {
      setLoginLoading(true);
      const res = await api.post('/auth/verify-code', { code: registrationCode });
      if (res.data.success) {
        alert('¡Cuenta verificada! Iniciando sesión...');
        finishLogin(res.data);
        setIsRegistering(false);
        setIsVerifyingRegistration(false);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoginLoading(false);
    }
  };


  return (
    <BrowserRouter>
      <CartProvider>
        {isAuthenticated ? (
          <Routes>
            {/* Rutas con Layout Principal (Sidebar y Header Global) */}
            <Route path="/" element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="pos" element={<POSPage />} />
              <Route path="entradas" element={<InventoryPage />} />
              <Route path="compras" element={<PurchaseSection />} />
              <Route path="usuarios" element={<div className="p-10">Módulo de Usuarios (En Construcción)</div>} />
              <Route path="admin/migracion" element={<MigrationTool />} />
              {/* Historial Legacy deshabilitado temporalmente
              <Route path="admin/historial-legacy" element={<LegacyHistoryPage />} />
              */}
              <Route path="historial" element={<HistoryPage />} />
            </Route>
          </Routes>
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-400">MCH Control</h1>
              <Login
                onLogin={handleLogin}
                onSendCode={handleSendCode}
                onRegister={handleRegister}
                onVerifyRegistration={handleVerifyRegistration}
                isRegistering={isRegistering}
                setIsRegistering={setIsRegistering}
                isLoginByCode={isLoginByCode}
                setIsLoginByCode={setIsLoginByCode}
                codeSent={codeSent}
                setCodeSent={setCodeSent}
                loginLoading={loginLoading}
                loginError={loginError}
                registerForm={registerForm}
                setRegisterForm={setRegisterForm}
                isVerifyingRegistration={isVerifyingRegistration}
                setIsVerifyingRegistration={setIsVerifyingRegistration}
                registrationCode={registrationCode}
                setRegistrationCode={setRegistrationCode}
                emailCode={emailCode}
                setEmailCode={setEmailCode}
                loginUsername={loginUsername}
                setLoginUsername={setLoginUsername}
                loginPassword={loginPassword}
                setLoginPassword={setLoginPassword}
              />
            </div>
          </div>
        )}
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
