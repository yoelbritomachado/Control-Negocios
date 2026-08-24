import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  ShieldCheck, 
  ShoppingBag, 
  Truck, 
  CreditCard, 
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MichuAssistantModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola Yoe! Soy **MichuSourcing**, tu asistente de abastecimiento estratégico, análisis de proveedores internacionales y soporte operativo para **Michulerías**.\n\n¿En qué te puedo asesorar hoy?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const quickQuestions = [
    { title: '🛡️ Seguridad VCC / Escrow', query: '¿Cómo asegurar pagos con proveedores en Alibaba?' },
    { title: '📦 Logística China ➔ Cuba', query: '¿Cuál es la mejor ruta para enviar mercancías a Cuba?' },
    { title: '🔄 Sincronización QR', query: '¿Cómo funciona el traspaso offline entre kioscos por QR?' },
    { title: '💡 Búsqueda de Proveedores', query: 'Requisitos para filtrar un proveedor seguro en Alibaba/AliExpress' }
  ];

  const handleSend = (textToSend) => {
    const queryText = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!queryText) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      const q = queryText.toLowerCase();

      if (q.includes('vcc') || q.includes('pago') || q.includes('tarjeta') || q.includes('escrow')) {
        botResponse = '🔒 **Protocolo de Seguridad de Pago en Compras**:\n\n1. **VCC Exclusivo**: Usá siempre Tarjetas Virtuales (VCC) de un solo uso con límite ajustado al monto exacto (vía Privacy, Wise o Capital One Eno). Nunca ingreses tarjetas físicas directas.\n2. **Trade Assurance (Alibaba)**: Garantiza que los fondos queden retenidos en *Escrow* hasta que el paquete llegue verificado a la agencia de consolidación en EE.UU.\n3. **Cero pagos externos**: Nunca aceptes pagar por WeChat directo o transferencias Western Union.';
      } else if (q.includes('logística') || q.includes('envío') || q.includes('cuba') || q.includes('ruta')) {
        botResponse = '📦 **Optimización Logística (China ➔ EE.UU. ➔ Cuba)**:\n\n- **Ruta Recomendada**: Proveedor internacional ➔ Consolidación en Miami/Kentucky ➔ Cuba.\n- **Agencias recomendadas**: CubaMax / agencias marítimas o aéreas con tarifa cerrada por libra/bulto.\n- **Cálculo de Landed Cost**: Recordá sumar siempre el costo unitario de compra + envío nacional US + tarifa de bulto a Cuba + arancel aduanal para fijar el precio de venta en kioscos con margen saludable.';
      } else if (q.includes('qr') || q.includes('sincronizar') || q.includes('offline') || q.includes('traslado')) {
        botResponse = '🔄 **Operativa Offline y Traspasos QR**:\n\n- **En Kioscos sin red**: Las ventas y traslados se guardan localmente de inmediato (IndexedDB).\n- **Transmitir Cambios**: Tocá el botón azul **[ Sincronizar ]** ➔ Seleccioná **"Transmitir Paquete QR"**.\n- **Recibir en la otra sede**: Abrí el botón **[ Sincronizar ]** ➔ **"Escanear Paquete QR"** y apuntá la cámara al QR. El stock y las ventas se absorben al instante sin necesidad de internet.';
      } else if (q.includes('proveedor') || q.includes('alibaba') || q.includes('aliexpress') || q.includes('filtro')) {
        botResponse = '🔎 **Criterios de Validación de Proveedores**:\n\n- **Alibaba**: Proveedor *Verified Supplier*, mínimo 2–3 años de antigüedad, soporte de Trade Assurance y tasa de respuesta > 90%.\n- **AliExpress**: Tiendas con > 95% de valoraciones positivas y ventas reales verificables.\n- **Banderas Rojas**: Precios anormalmente bajos, pedir liquidación fuera de plataforma o evasivas ante fotos del empaque real.';
      } else {
        botResponse = `Entendido. Registré tu consulta sobre "${queryText}". Como MichuSourcing, estoy configurado para optimizar cada compra mayorista de **Michulerías**, cuidando el capital y garantizando que las operaciones entre almacén y puntos de venta fluyan con total seguridad.`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botResponse,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl h-[90vh] sm:h-[650px] bg-slate-900 border border-pink-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-pink-950/40 via-slate-900 to-slate-900 border-b border-pink-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">MichuSourcing</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> IA Michulerías
                </span>
              </div>
              <p className="text-xs text-slate-400">Abastecimiento estratégico, seguridad en compras y soporte</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {quickQuestions.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip.query)}
              className="px-3 py-1 rounded-full bg-slate-800/70 hover:bg-pink-500/20 border border-slate-700/60 hover:border-pink-500/40 text-slate-300 hover:text-pink-200 text-xs whitespace-nowrap transition-all"
            >
              {chip.title}
            </button>
          ))}
        </div>

        {/* Chat Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-slate-900/60">
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div 
                key={m.id} 
                className={`flex gap-3 ${isBot ? 'items-start' : 'items-end justify-end'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div 
                  className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                    isBot 
                      ? 'bg-slate-800/80 text-slate-200 border border-slate-700/60 shadow-sm' 
                      : 'bg-pink-600 text-white shadow-md shadow-pink-600/20 rounded-br-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <span className={`block text-[10px] mt-1.5 ${isBot ? 'text-slate-500' : 'text-pink-200 text-right'}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntale a MichuSourcing sobre proveedores, logística, o el sistema..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-white text-sm outline-none transition-all placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-40 text-white font-medium shadow-md shadow-pink-600/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
