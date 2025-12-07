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

export type DailyAdjustmentMap = Record<string, Record<string, Record<string, number>>>;

let cache = {
  employees: [] as Employee[],
  items: [] as Item[],
  consumption: [] as Consumption[],
  dailyAdjustments: {} as DailyAdjustmentMap,
  isLoaded: false
};

// Helper: Ensure we get a consistent YYYY-MM-DD string regardless of input format
const normalizeDateKey = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val).split('T')[0]; // Fallback to string split
        // Adjust for timezone offset to prevent UTC shifting the day back
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().split('T')[0];
    } catch (e) {
        return String(val).split('T')[0];
    }
};

// Helper: Ensure full ISO string for consumption records, but localized
const safeISODate = (val: any): string => {
    try {
        if (!val) return new Date().toISOString();
        const d = new Date(val);
        if (isNaN(d.getTime())) return new Date().toISOString();
        // Return ISO string but corrected for local offset (preserving user's "Today")
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().slice(0, -1); // remove Z
    } catch (e) {
        return new Date().toISOString();
    }
};

export const StorageService = {
  
  init: async (): Promise<void> => {
    if (cache.isLoaded) return;

    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') {
      console.warn("API URL not set. Using fallback data.");
      cache.employees = FALLBACK_EMPLOYEES;
      cache.items = FALLBACK_ITEMS;
      cache.isLoaded = true;
      return;
    }

    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`); // Cache buster
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const text = await response.text();

      if (!text || text.trim() === "undefined" || text.trim() === "") {
          console.warn("API returned empty response.");
          if (cache.employees.length === 0) {
             cache.employees = FALLBACK_EMPLOYEES;
             cache.items = FALLBACK_ITEMS;
          }
          cache.isLoaded = true;
          return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON", e);
        throw new Error("Invalid JSON");
      }
      
      const normalize = (obj: any) => {
        const n: any = {};
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => {
                n[k.trim().toLowerCase()] = obj[k];
            });
        }
        return n;
      };
      
      cache.employees = (data.employees || []).map((raw: any) => {
        const e = normalize(raw);
        const isActive = e.isactive === true || String(e.isactive).toLowerCase() === 'true' || e.isactive === 1;
        return {
          id: String(e.id || Math.random().toString(36).substr(2, 9)), 
          name: e.name || 'Unknown', 
          isActive: isActive
        };
      });
      
      cache.items = (data.items || []).map((raw: any) => {
        const i = normalize(raw);
        const isActive = i.isactive === true || String(i.isactive).toLowerCase() === 'true' || i.isactive === 1;
        return {
          id: String(i.id || Math.random().toString(36).substr(2, 9)),
          name: i.name || 'Unknown', 
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
          date: safeISODate(c.date),
          quantity: Number(c.quantity) > 0 ? Number(c.quantity) : 1 
        };
      });

      // Handle Adjustments: Ensure keys are strictly YYYY-MM-DD
      const rawAdjustments = (typeof data.dailyAdjustments === 'object') ? data.dailyAdjustments : {};
      cache.dailyAdjustments = {};
      
      Object.keys(rawAdjustments).forEach(rawDate => {
          const cleanDate = normalizeDateKey(rawDate);
          cache.dailyAdjustments[cleanDate] = rawAdjustments[rawDate];
      });

      cache.isLoaded = true;
      console.log(`Loaded ${cache.consumption.length} logs and adjustments for ${Object.keys(cache.dailyAdjustments).length} days.`);

    } catch (error) {
      console.error("StorageService Init Error:", error);
      if (cache.employees.length === 0) {
          cache.employees = FALLBACK_EMPLOYEES;
          cache.items = FALLBACK_ITEMS;
      }
      cache.isLoaded = true;
    }
  },

  getEmployees: (): Employee[] => cache.employees,
  getItems: (): Item[] => cache.items,
  getConsumptions: (): Consumption[] => cache.consumption,
  getDailyAdjustments: (): DailyAdjustmentMap => cache.dailyAdjustments,
  getActiveEmployeesCount: (): number => cache.employees.filter(e => e.isActive).length,

  addConsumption: async (entry: Consumption) => {
    cache.consumption.push(entry);
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_consumption', data: entry })
    });
  },

  addConsumptionBatch: async (entries: Consumption[]) => {
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
    cache.consumption = cache.consumption.filter(c => c.id !== id);
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_consumption', data: { id } })
    });
  },

  removeConsumptionBatch: async (ids: string[]) => {
    const idSet = new Set(ids);
    cache.consumption = cache.consumption.filter(c => !idSet.has(c.id));
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_consumption_batch', data: { ids } })
    });
  },

  saveDailyAdjustments: async (adjustments: DailyAdjustmentMap) => {
    cache.dailyAdjustments = adjustments;
    if (API_URL.includes('YOUR_APPS_SCRIPT') || API_URL === '') return;
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_adjustments', data: adjustments })
    });
  },

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