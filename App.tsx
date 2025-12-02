import React, { useState } from 'react';
import { DailyEntry } from './components/DailyEntry';
import { WeeklyReport } from './components/WeeklyReport';
import { BillGenerator } from './components/BillGenerator';
import { AdminPanel } from './components/AdminPanel';
import { Coffee, ClipboardList, Settings, Receipt } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'entry' | 'report' | 'bill' | 'admin'>('entry');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-tea-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-tea-500 rounded-lg flex items-center justify-center text-white">
              <Coffee className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Tea<span className="text-tea-600">Desk</span></h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            <button 
              onClick={() => setCurrentView('entry')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${currentView === 'entry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Coffee className="w-4 h-4" />
              Daily Entry
            </button>
            <button 
              onClick={() => setCurrentView('report')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${currentView === 'report' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <ClipboardList className="w-4 h-4" />
              Reports
            </button>
            <button 
              onClick={() => setCurrentView('bill')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${currentView === 'bill' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Receipt className="w-4 h-4" />
              Bill
            </button>
            <button 
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${currentView === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Settings className="w-4 h-4" />
              Admin
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-65px)] max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {currentView === 'entry' && (
            <div className="animate-fade-in">
                <DailyEntry />
            </div>
        )}
        {currentView === 'report' && (
            <div className="animate-fade-in">
                <WeeklyReport />
            </div>
        )}
        {currentView === 'bill' && (
            <div className="animate-fade-in">
                <BillGenerator />
            </div>
        )}
        {currentView === 'admin' && (
            <div className="animate-fade-in">
                <AdminPanel />
            </div>
        )}
      </main>
      
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center text-gray-400 text-sm print:hidden">
        <p>&copy; {new Date().getFullYear()} teadesk. Built with React & Tailwind.</p>
      </footer>
    </div>
  );
};

export default App;