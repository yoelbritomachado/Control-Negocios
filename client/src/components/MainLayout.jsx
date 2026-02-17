import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../lib/utils';
import { Sparkles } from 'lucide-react';

// Background Animation Component
function AnimatedBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Gradient Orbs */}
            <motion.div
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                }}
                className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl"
            />
            <motion.div
                animate={{
                    x: [0, -100, 0],
                    y: [0, 50, 0],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: 'linear',
                }}
                className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl"
            />
            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, 100, 0],
                }}
                transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: 'linear',
                }}
                className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
            />

            {/* Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px',
                }}
            />
        </div>
    );
}

// Welcome Animation
function WelcomeAnimation({ onComplete }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            sessionStorage.setItem('welcomeShown', 'true');
            onComplete();
        }, 2500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, hsl(222 47% 6%) 0%, hsl(222 47% 8%) 100%)',
            }}
        >
            <div className="text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="relative inline-block mb-6"
                >
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/50">
                        <Sparkles className="w-12 h-12 text-white" />
                    </div>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/30"
                        style={{ transform: 'scale(1.2)' }}
                    />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="text-4xl font-bold mb-2"
                >
                    <span className="gradient-text">BizControl</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="text-muted-foreground text-lg"
                >
                    Sistema Premium de Gestión Económica
                </motion.p>

                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 0.8, duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                    className="h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 rounded-full mt-8 max-w-xs mx-auto"
                />
            </div>
        </motion.div>
    );
}

export default function MainLayout() {
    const [isDark, setIsDark] = useState(true);
    const [showWelcome, setShowWelcome] = useState(() => {
        // Solo mostrar welcome animation una vez por sesión
        return !sessionStorage.getItem('welcomeShown');
    });

    // Get user info from localStorage if available
    const [userInfo, setUserInfo] = useState({
        businessName: 'MCH 1',
        userName: 'Administrador',
        userRole: 'Acceso Maestro'
    });

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setUserInfo(prev => ({
                    ...prev,
                    userName: user.username || 'Usuario',
                    userRole: user.role === 'admin' ? 'Administrador' : 'Vendedor'
                }));
            } catch (e) {
                console.error("Error parsing user info", e);
            }
        }
    }, []);

    // Toggle theme
    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
    };

    // Initialize dark mode
    useEffect(() => {
        document.documentElement.classList.add('dark');
    }, []);

    return (
        <div className={cn(
            'min-h-screen transition-colors duration-500 flex',
            isDark ? 'dark' : ''
        )}>
            {/* Welcome Animation */}
            <AnimatePresence>
                {showWelcome && (
                    <WelcomeAnimation onComplete={() => setShowWelcome(false)} />
                )}
            </AnimatePresence>

            {/* Background */}
            <AnimatedBackground />

            {/* Sidebar */}
            <Sidebar
                isDark={isDark}
                toggleTheme={toggleTheme}
            />

            {/* Main Content */}
            <main className={cn(
                'transition-all duration-500 min-h-screen flex-1',
                'ml-0 lg:ml-72' // Sidebar spacing
            )}>
                <div className="p-6 lg:p-8">
                    <Header
                        userName={userInfo.userName}
                        userRole={userInfo.userRole}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <Outlet />
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
