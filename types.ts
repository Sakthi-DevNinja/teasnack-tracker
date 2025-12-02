export interface Employee {
  id: string;
  name: string;
  isActive: boolean;
}

export type ItemType = 'drink' | 'snack';

export interface Item {
  id: string;
  name: string;
  price: number;
  type: ItemType;
  isActive: boolean;
}

export interface Consumption {
  id: string;
  employeeId: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  price: number;
  date: string; // ISO Date String
}

export interface WeeklySummary {
  employeeId: string;
  employeeName: string;
  snacksTotal: number;
  drinksCount: number;
}

export interface TallyResult {
  date: string;
  actualTeaCount: number;
  totalEmployees: number;
  adjustedTeaCount: number;
  snackOnlyConsumers: string[];
  extraSnackConsumers: string[];
  finalCompanyCost: number;
  gapFilled: number;
}
