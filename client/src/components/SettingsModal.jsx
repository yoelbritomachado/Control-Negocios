import React, { useState } from 'react';
import { FaSave, FaTimes, FaShieldAlt, FaTrash, FaUserShield, FaBan, FaSignOutAlt, FaToggleOn, FaToggleOff, FaCoins, FaUpload, FaExclamationTriangle } from 'react-icons/fa';

const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onSaveSettings,
  currentUser,
  adminData,
  onToggleRegistration,
  onBanUser,
  onKickUser,
  onDeleteUser,
  onTogglePermission,
  onToggleVerification,
  securityForm,
  setSecurityForm,
  onSaveSecurity,
  onRestoreBackup
}) => {
  const [activeTab, setActiveTab] = useState('general');
  // Use currentUser object to determine admin status
  // Either by explicit role OR by fallback to hardcoded email for safety
  const isAdmin = (currentUser?.role === 'admin') || (currentUser?.email === 'yoelbritomachado@gmail.com');

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-all animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`text-sm font-bold px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'general' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Configuración
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`text-sm font-bold px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Admin Panel
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-800">
          {activeTab === 'general' ? (
            <div className="space-y-8">
              {/* Form Settings */}
              <form onSubmit={onSaveSettings} className="space-y-6">

                {/* Currency Selector */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <FaCoins size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">Moneda Principal</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Divisa base para cálculos (junto a MN).
                      </p>
                    </div>
                  </div>
                  <select
                    name="PRIMARY_CURRENCY"
                    value={settings.PRIMARY_CURRENCY || 'MXN'}
                    onChange={(e) => setSettings(prev => ({ ...prev, PRIMARY_CURRENCY: e.target.value }))}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-bold outline-none"
                  >
                    <option value="MXN">MXN ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Explicitly Render Only Relevant Rates */}
                  {[
                    { key: 'RATE_MXN_USD', label: 'Tasa MXN a USD ($)' },
                    { key: 'RATE_USD_MN', label: 'Tasa USD a MN (CUP)' },
                    { key: 'RATE_EUR_MN', label: 'Tasa EUR a MN (CUP)' },
                    { key: 'RATE_MXN_MN', label: 'Tasa MXN a MN (CUP)' },
                    { key: 'MARGIN_MULTIPLIER', label: 'Margen de Ganancia (x)' }
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-2 group">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name={key}
                        value={settings[key] || 0}
                        onChange={handleSettingChange}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
                >
                  <FaSave /> Guardar Configuración
                </button>
              </form>

              {/* Security Settings (SMTP) - ADMIN ONLY */}
              {isAdmin && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FaShieldAlt /> Configuración de Seguridad (SMTP)
                  </h3>
                  <form onSubmit={onSaveSecurity} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Servidor SMTP (ej. smtp.gmail.com)"
                        value={securityForm.smtp_host}
                        onChange={e => setSecurityForm({ ...securityForm, smtp_host: e.target.value })}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Puerto (ej. 587)"
                        value={securityForm.smtp_port}
                        onChange={e => setSecurityForm({ ...securityForm, smtp_port: e.target.value })}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Usuario / Correo"
                        value={securityForm.smtp_user}
                        onChange={e => setSecurityForm({ ...securityForm, smtp_user: e.target.value })}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Contraseña de App"
                        value={securityForm.smtp_pass}
                        onChange={e => setSecurityForm({ ...securityForm, smtp_pass: e.target.value })}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg text-xs uppercase transition-colors"
                    >
                      Actualizar SMTP
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            // ADMIN PANEL TAB
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div>
                  <h4 className="font-bold text-red-600 dark:text-red-400">Control de Registro</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {adminData.registrationAllowed ? 'El registro de nuevos usuarios está ABIERTO.' : 'El registro está CERRADO.'}
                  </p>
                </div>

                <button
                  onClick={() => onToggleRegistration(!adminData.registrationAllowed)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${adminData.registrationAllowed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${adminData.registrationAllowed ? 'translate-x-6' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div>
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400">Exportar Datos</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Descarga todos los datos (productos, configuraciones y usuarios) en formato JSON.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/backup-json');
                      const data = await res.json();
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      const timestamp = new Date().toISOString().split('T')[0];
                      a.href = url;
                      a.download = `respaldo_inventario_${timestamp}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error(err);
                      alert('Error al descargar el respaldo. Asegúrese de que el servidor esté actualizado y reiniciado.');
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors"
                >
                  <FaCoins /> Descargar JSON
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase font-bold text-xs">
                    <tr>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Rol / Permisos</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {adminData.users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3">
                          <div className="font-bold text-gray-900 dark:text-white">{u.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                        </td>
                        <td className="p-3">
                          {(u.email !== 'yoelbritomachado@gmail.com') ? (
                            <button
                              onClick={() => onTogglePermission(u.id, u.can_edit)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-2 border ${
                                u.can_edit 
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 hover:bg-indigo-200' 
                                  : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-200'
                              }`}
                              title="Clic para cambiar permisos"
                            >
                              {u.can_edit ? <FaToggleOn size={14} /> : <FaToggleOff size={14} />}
                              {u.can_edit ? 'Editor (Puede Editar)' : 'Lector (Solo Lectura)'}
                            </button>
                          ) : (
                            <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-1 rounded-full font-bold uppercase border border-purple-200 dark:border-purple-800">
                              Administrador Total
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            {u.is_banned ? (
                              <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded text-[10px] font-bold uppercase">Baneado</span>
                            ) : u.is_verified ? (
                              <span className="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded text-[10px] font-bold uppercase">Activo</span>
                            ) : (
                              <button 
                                onClick={() => onToggleVerification(u.id, 0)}
                                className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-yellow-200 transition-colors animate-pulse"
                                title="Clic para Verificar Manualmente"
                              >
                                Pendiente (Verificar)
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {(u.email !== 'yoelbritomachado@gmail.com') ? (
                            <>
                              <button
                                onClick={() => onBanUser(u.id, u.is_banned)}
                                className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                                title={u.is_banned ? "Desbloquear" : "Bloquear"}
                              >
                                {u.is_banned ? <FaUserShield /> : <FaBan />}
                              </button>
                              <button
                                onClick={() => onKickUser(u.id)}
                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                title="Cerrar Sesión (Kick)"
                              >
                                <FaSignOutAlt />
                              </button>
                              <button
                                onClick={() => onDeleteUser(u.id)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Eliminar Usuario"
                              >
                                <FaTrash />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic font-bold">Admin Principal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Safety Zone (Restore) */}
              <div className="border-t-2 border-dashed border-red-200 dark:border-red-900/30 pt-8 mt-8">
                <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <FaExclamationTriangle /> Zona de Peligro: Restauración
                </h3>
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <p className="text-sm text-red-700 dark:text-red-400 mb-4 font-bold">
                    ⚠️ ATENCIÓN: Al restaurar un respaldo, se borrarán todos los datos actuales del sistema y se reemplazarán por los del archivo. Esta acción no se puede deshacer.
                  </p>
                  <label className="flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 transition-all group">
                    <FaUpload className="text-red-500 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-red-600 dark:text-red-400 text-sm">SELECCIONAR ARCHIVO DE RESPALDO (JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const data = JSON.parse(event.target.result);
                              if (window.confirm("¿Estás seguro de que deseas restaurar este respaldo? Se perderán todos los datos actuales.")) {
                                onRestoreBackup(data);
                              }
                            } catch (err) {
                              console.error(err);
                              alert("Error al leer el archivo de respaldo.");
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
