import { GoogleGenAI } from "@google/genai";
import { Consumption, Employee, Item, TallyResult } from "../types";

// NOTE: In a real environment, this should be accessed safely. 
// For this demo, we assume the key is available or provided by the user in the UI.
export const generateWeeklyInsight = async (
  consumptions: Consumption[],
  employees: Employee[],
  items: Item[],
  tallyResults: TallyResult[]
): Promise<string> => {
  // Always use a new instance with the API key from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const summaryData = {
    totalConsumptionCount: consumptions.length,
    dateRange: {
        start: consumptions[0]?.date,
        end: consumptions[consumptions.length - 1]?.date
    },
    tallyAdjustments: tallyResults.map(t => ({
        date: t.date,
        gapFilled: t.gapFilled,
        finalCost: t.finalCompanyCost
    })),
    topConsumers: calculateTopConsumers(consumptions, employees)
  };

  const prompt = `
    Analyze the following office tea/snack consumption data and provide a brief, professional executive summary (max 3 sentences).
    Highlight any unusual spikes in snacks or significant tally adjustments where the company paid for more tea than was actually consumed to match the employee count.
    
    Data: ${JSON.stringify(summaryData, null, 2)}
  `;

  try {
    // Correctly using ai.models.generateContent with 'gemini-3-flash-preview' for text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Accessing .text property directly
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this time.";
  }
};

function calculateTopConsumers(consumptions: Consumption[], employees: Employee[]) {
    const counts: Record<string, number> = {};
    consumptions.forEach(c => {
        const name = employees.find(e => e.id === c.employeeId)?.name || 'Unknown';
        counts[name] = (counts[name] || 0) + c.price;
    });
    return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, total]) => ({ name, total }));
}