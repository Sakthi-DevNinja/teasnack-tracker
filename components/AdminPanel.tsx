import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { Employee, Item } from '../types';
import { Settings, Users, Coffee, Loader2, Plus, Pencil, X, Save } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null); // Track ID currently being toggled
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'items'>('employees');

  // Edit States
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form States
  const [newEmpName, setNewEmpName] = useState('');
  const [newItem, setNewItem] = useState<{name: string; price: number; type: 'drink' | 'snack'}>({ name: '', price: 10, type: 'snack' });

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    await StorageService.init();
    refreshData();
    setLoading(false);
  };

  const refreshData = () => {
    // Spread into new array to force React re-render when cache reference is the same
    setEmployees([...StorageService.getEmployees()]);
    setItems([...StorageService.getItems()]);
  };

  // --- Employee Handlers ---

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || submitting) return;

    setSubmitting(true);
    try {
        let empId = editingEmployeeId;
        let isActive = true;

        if (empId) {
            const existing = employees.find(e => e.id === empId);
            if (existing) isActive = existing.isActive;
        } else {
            const maxId = employees.reduce((max, emp) => {
                const idNum = parseInt(emp.id, 10);
                return !isNaN(idNum) && idNum > max ? idNum : max;
            }, 0);
            empId = (maxId + 1).toString();
        }

        if (empId) {
            await StorageService.saveEmployee({
                id: empId,
                name: newEmpName,
                isActive: isActive
            });
            resetEmployeeForm();
            refreshData();
        }
    } finally {
        setSubmitting(false);
    }
  };

  const startEditEmployee = (emp: Employee) => {
      setNewEmpName(emp.name);
      setEditingEmployeeId(emp.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetEmployeeForm = () => {
      setNewEmpName('');
      setEditingEmployeeId(null);
  };

  const toggleEmployeeStatus = async (emp: Employee) => {
    if (togglingId) return; // Prevent multiple toggles
    setTogglingId(emp.id);
    try {
        await StorageService.saveEmployee({ ...emp, isActive: !emp.isActive });
        refreshData();
    } finally {
        setTogglingId(null);
    }
  };

  // --- Item Handlers ---

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || submitting) return;

    setSubmitting(true);
    try {
        let itemId = editingItemId;
        let isActive = true;

        if (itemId) {
            const existing = items.find(i => i.id === itemId);
            if (existing) isActive = existing.isActive;
        } else {
            const maxId = items.reduce((max, item) => {
                if (item.id.startsWith('i')) {
                    const idNum = parseInt(item.id.substring(1), 10);
                    return !isNaN(idNum) && idNum > max ? idNum : max;
                }
                return max;
            }, 0);
            itemId = `i${maxId + 1}`;
        }

        if (itemId) {
            await StorageService.saveItem({
                id: itemId,
                name: newItem.name,
                price: newItem.price,
                type: newItem.type,
                isActive: isActive
            });
            resetItemForm();
            refreshData();
        }
    } finally {
        setSubmitting(false);
    }
  };

  const startEditItem = (item: Item) => {
      setNewItem({ name: item.name, price: item.price, type: item.type });
      setEditingItemId(item.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetItemForm = () => {
      setNewItem({ name: '', price: 10, type: 'snack' });
      setEditingItemId(null);
  };

  const toggleItemStatus = async (item: Item) => {
    if (togglingId) return;
    setTogglingId(item.id);
    try {
        await StorageService.saveItem({ ...item, isActive: !item.isActive });
        refreshData();
    } finally {
        setTogglingId(null);
    }
  };

  const handlePriceUpdate = async (item: Item, newPrice: number) => {
    await StorageService.saveItem({ ...item, price: newPrice });
    refreshData();
  };

  if (loading) {
      return <div className="flex h-64 justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-tea-600"/></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'employees' ? 'bg-tea-50 text-tea-700 border-b-2 border-tea-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setActiveTab('employees'); resetEmployeeForm(); }}
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            Employees
          </div>
        </button>
        <button
          className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'items' ? 'bg-tea-50 text-tea-700 border-b-2 border-tea-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setActiveTab('items'); resetItemForm(); }}
        >
          <div className="flex items-center justify-center gap-2">
            <Coffee className="w-4 h-4" />
            Items & Prices
          </div>
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'employees' ? (
          <div className="space-y-6">
            <form onSubmit={handleSubmitEmployee} className="flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
              <input
                type="text"
                placeholder="Employee Name"
                className="flex-1 p-3 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-tea-500 disabled:opacity-50"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                disabled={submitting}
              />
              <button 
                type="submit" 
                disabled={submitting || !newEmpName.trim()}
                className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white ${editingEmployeeId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-tea-600 hover:bg-tea-700'}`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingEmployeeId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                {editingEmployeeId ? 'Update' : 'Add'}
              </button>
              {editingEmployeeId && (
                  <button 
                    type="button"
                    onClick={resetEmployeeForm}
                    className="p-3 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                    title="Cancel Edit"
                  >
                      <X className="w-4 h-4" />
                  </button>
              )}
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employees.map(emp => (
                <div key={emp.id} className={`flex items-center justify-between p-4 rounded-lg border transition-all ${emp.isActive ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                  <span className="font-medium text-gray-800 flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">#{emp.id}</span>
                    {emp.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                        onClick={() => startEditEmployee(emp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit Name"
                        disabled={togglingId === emp.id}
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => toggleEmployeeStatus(emp)}
                        disabled={togglingId === emp.id}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all w-20 flex justify-center ${emp.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                        {togglingId === emp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (emp.isActive ? 'Active' : 'Inactive')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleSubmitItem} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="md:col-span-4">
                  <input
                    type="text"
                    placeholder="Item Name"
                    className="w-full p-2 border border-gray-200 rounded outline-none disabled:opacity-50"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    disabled={submitting}
                  />
              </div>
              <div className="md:col-span-3">
                <select
                    className="w-full p-2 border border-gray-200 rounded outline-none disabled:opacity-50 bg-white"
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'drink' | 'snack' })}
                    disabled={submitting}
                >
                    <option value="drink">Drink (Company)</option>
                    <option value="snack">Snack (Employee)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-full p-2 border border-gray-200 rounded outline-none disabled:opacity-50"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                    disabled={submitting}
                  />
              </div>
              <div className="md:col-span-3 flex gap-2">
                  <button 
                    type="submit" 
                    disabled={submitting || !newItem.name.trim()}
                    className={`flex-1 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingItemId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-tea-600 hover:bg-tea-700'}`}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingItemId ? 'Update' : 'Add')}
                  </button>
                  {editingItemId && (
                      <button 
                        type="button"
                        onClick={resetItemForm}
                        className="px-3 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                      >
                          <X className="w-4 h-4" />
                      </button>
                  )}
              </div>
            </form>

            <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Price (₹)</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${!item.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                                <td className="p-3 text-xs text-gray-400 font-mono">{item.id}</td>
                                <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                <td className="p-3">
                                    <span className={`text-xs px-2 py-1 rounded ${item.type === 'drink' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                        {item.type === 'drink' ? 'Company' : 'Personal'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number"
                                        className="w-20 p-1 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-tea-500 bg-white"
                                        value={item.price}
                                        onChange={(e) => handlePriceUpdate(item, Number(e.target.value))}
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => startEditItem(item)}
                                            className="text-blue-600 hover:bg-blue-100 p-2 rounded transition-colors"
                                            title="Edit Item"
                                            disabled={togglingId === item.id}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => toggleItemStatus(item)}
                                            disabled={togglingId === item.id}
                                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all w-20 flex justify-center ${item.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                        >
                                            {togglingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (item.isActive ? 'Active' : 'Inactive')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};