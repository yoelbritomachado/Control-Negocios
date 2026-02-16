import React, { useState } from 'react';

// A simple modal to confirm inventory creation/switching or whatever
// Or, if this file was missing and causing issues, here is a placeholder.
// But mostly we need it for the ported code.

export default function InventoryModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Nueva Sede / Inventario</h2>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ej: Almacén Central"
          className="w-full p-3 border rounded-lg mb-4 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-700">Cancelar</button>
          <button
            onClick={() => onCreate(name)}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
