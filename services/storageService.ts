import { Employee, Item, Consumption } from '../types';

// YOUR CONFIGURED API URL
const API_URL: string = 'https://script.google.com/macros/s/AKfycbzSpeYPsgzXsUwBxbIupmWTl1KQ4bmiMMMiHA9UBXossOwohO_HdCxcivDbspl783-3/exec';

// Fallback data if API fails or is not set up
const FALLBACK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Gopalan', isActive: true },
  { id: '2', name: 'Navin', isActive: true },
];
const FALLBACK_ITEMS: Item[] = [
  { id: 'i1', name: 'Tea', price: 10, type: 'drink', isActive: true },
  { id: 'i2', name: 'Coffee', price: 15, type: 'drink', isActive: true },
  { id: 'i3', name: 'Milk', price: 10, type: 'drink', isActive: true },
  { id: 'i4', name: 'Bonda', price: 10, type: 'snack', isActive: true },
  { id: 'i5', name: 'Bajji', price: 10, type: 'snack', isActive: true },
  { id: 'i6', name: 'Vada', price: 10, type: 'snack', isActive: true },
];

// In-memory cache to reduce network calls for synchronous-like feel in UI
let cache = {
  employees: [] as Employee[],
  items: [] as Item[],
  consumption: [] as Consumption[],
  dailyAdjustments: {} as Record<string, Record<string, number>>,
  isLoaded: false
};

export const StorageService = {
  
  // --- Initialization ---
  
  // Call this when the app starts or when refreshing data
  init: async (): Promise<void> => {
    // Check if the URL is still the default placeholder or empty
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') {
      console.warn("API URL not set. Using fallback data.");
      cache.employees = FALLBACK_EMPLOYEES;
      cache.items = FALLBACK_ITEMS;
      cache.isLoaded = true;
      return;
    }

    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      
      // Helper to normalize keys to lowercase AND TRIM WHITESPACE to handle Sheet header variations
      const normalize = (obj: any) => {
        const n: any = {};
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => {
                n[k.trim().toLowerCase()] = obj[k];
            });
        }
        return n;
      };
      
      // Parse Sheets Data with robust mapping
      cache.employees = (data.employees || []).map((raw: any) => {
        const e = normalize(raw);
        // Check various truthy formats for active status
        const isActive = e.isactive === true || String(e.isactive).toLowerCase() === 'true' || e.isactive === 1;
        
        return {
          id: String(e.id || Math.random().toString(36).substr(2, 9)), 
          name: e.name || 'Unknown Employee', 
          isActive: isActive
        };
      });
      
      cache.items = (data.items || []).map((raw: any) => {
        const i = normalize(raw);
        const isActive = i.isactive === true || String(i.isactive).toLowerCase() === 'true' || i.isactive === 1;
        
        return {
          id: String(i.id || Math.random().toString(36).substr(2, 9)),
          name: i.name || 'Unknown Item', 
          price: Number(i.price) || 0,
          type: (i.type || '').toLowerCase().includes('drink') ? 'drink' : 'snack',
          isActive: isActive
        };
      });

      cache.consumption = (data.consumption || []).map((raw: any) => {
        const c = normalize(raw);
        return {
          id: String(c.id || Math.random().toString(36).substr(2, 9)),
          employeeId: String(c.employeeid || ''),
          itemId: String(c.itemid || ''),
          itemName: c.itemname || 'Unknown',
          itemType: (c.itemtype || '').toLowerCase().includes('drink') ? 'drink' : 'snack',
          price: Number(c.price) || 0,
          date: c.date || new Date().toISOString()
        };
      });

      cache.dailyAdjustments = data.dailyAdjustments || {};
      
      cache.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch data from Google Sheet", error);
      if (cache.employees.length === 0) {
          cache.employees = FALLBACK_EMPLOYEES;
          cache.items = FALLBACK_ITEMS;
      }
    }
  },

  // --- Getters (Sync, read from cache) ---
  
  getEmployees: (): Employee[] => cache.employees,
  
  getItems: (): Item[] => cache.items,
  
  getConsumptions: (): Consumption[] => cache.consumption,
  
  getDailyAdjustments: (): Record<string, Record<string, number>> => cache.dailyAdjustments,
  
  getActiveEmployeesCount: (): number => cache.employees.filter(e => e.isActive).length,

  // --- Actions (Async, write to API & update cache) ---

  addConsumption: async (entry: Consumption) => {
    // Optimistic Update
    cache.consumption.push(entry);
    
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_consumption', data: entry })
    });
  },

  // NEW: Batch Add
  addConsumptionBatch: async (entries: Consumption[]) => {
    // Optimistic Update
    cache.consumption.push(...entries);
    
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_consumption_batch', data: entries })
    });
  },

  removeConsumption: async (id: string) => {
    // Optimistic Update
    cache.consumption = cache.consumption.filter(c => c.id !== id);

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_consumption', data: { id } })
    });
  },

  // NEW: Batch Remove
  removeConsumptionBatch: async (ids: string[]) => {
    const idSet = new Set(ids);
    // Optimistic Update
    cache.consumption = cache.consumption.filter(c => !idSet.has(c.id));

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_consumption_batch', data: { ids } })
    });
  },

  saveDailyAdjustments: async (adjustments: Record<string, Record<string, number>>) => {
    cache.dailyAdjustments = adjustments;

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_adjustments', data: adjustments })
    });
  },

  // For Admin Panel
  saveEmployee: async (employee: Employee) => {
    const idx = cache.employees.findIndex(e => e.id === employee.id);
    if (idx >= 0) cache.employees[idx] = employee;
    else cache.employees.push(employee);

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_employee', data: employee })
    });
  },

  saveItem: async (item: Item) => {
    const idx = cache.items.findIndex(i => i.id === item.id);
    if (idx >= 0) cache.items[idx] = item;
    else cache.items.push(item);

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_item', data: item })
    });
  }
};