import { useState, useEffect } from 'react';
import api from '../api';

export default function ExpenseTypesConfig() {
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [newType, setNewType] = useState({ name: '', amount: '' });
    const [editingType, setEditingType] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadExpenseTypes();
    }, []);

    const loadExpenseTypes = async () => {
        try {
            const res = await api.get('/expense-types');
            setExpenseTypes(res.data);
        } catch (e) {
            console.error('Error loading expense types:', e);
        }
    };

    const handleAdd = async () => {
        if (!newType.name || !newType.amount) {
            setMessage('Nombre y monto son requeridos');
            return;
        }
        setLoading(true);
        try {
            await api.post('/expense-types', {
                name: newType.name,
                amount: parseFloat(newType.amount)
            });
            setNewType({ name: '', amount: '' });
            setMessage('Tipo de gasto agregado');
            loadExpenseTypes();
        } catch (e) {
            setMessage('Error al agregar: ' + e.message);
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editingType) return;
        setLoading(true);
        try {
            await api.put(`/expense-types/${editingType.id}`, editingType);
            setEditingType(null);
            setMessage('Tipo de gasto actualizado');
            loadExpenseTypes();
        } catch (e) {
            setMessage('Error al actualizar: ' + e.message);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este tipo de gasto?')) return;
        setLoading(true);
        try {
            await api.delete(`/expense-types/${id}`);
            setMessage('Tipo de gasto eliminado');
            loadExpenseTypes();
        } catch (e) {
            setMessage('Error al eliminar: ' + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="expense-types-config">
            <h3>Tipos de Gastos Predefinidos</h3>
            
            {message && (
                <div className="message">{message}</div>
            )}

            <div className="add-type-form">
                <input
                    type="text"
                    placeholder="Nombre del gasto"
                    value={newType.name}
                    onChange={(e) => setNewType({...newType, name: e.target.value})}
                />
                <input
                    type="number"
                    placeholder="Monto $"
                    value={newType.amount}
                    onChange={(e) => setNewType({...newType, amount: e.target.value})}
                />
                <button onClick={handleAdd} disabled={loading}>
                    Agregar
                </button>
            </div>

            <div className="expense-types-list">
                {expenseTypes.map(type => (
                    <div key={type.id} className="expense-type-item">
                        {editingType?.id === type.id ? (
                            <>
                                <input
                                    type="text"
                                    value={editingType.name}
                                    onChange={(e) => setEditingType({...editingType, name: e.target.value})}
                                />
                                <input
                                    type="number"
                                    value={editingType.amount}
                                    onChange={(e) => setEditingType({...editingType, amount: e.target.value})}
                                />
                                <button onClick={handleUpdate}>Guardar</button>
                                <button onClick={() => setEditingType(null)}>Cancelar</button>
                            </>
                        ) : (
                            <>
                                <span className="type-name">{type.name}</span>
                                <span className="type-amount">${type.amount.toFixed(2)}</span>
                                <button onClick={() => setEditingType(type)}>Editar</button>
                                <button onClick={() => handleDelete(type.id)}>Eliminar</button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
