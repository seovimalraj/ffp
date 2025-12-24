// Simple file-based storage for abandoned quotes
// In production, this should be replaced with a proper database

import fs from 'fs/promises';
import path from 'path';

interface AbandonedQuoteData {
  quoteId: string
  userId?: string
  guestEmail?: string
  currentStep: 'file_upload' | 'pricing_review' | 'checkout_started' | 'payment_info'
  files: Array<{
    fileId: string
    fileName: string
    fileSize?: number
    contentType?: string
  }>
  selectedLeadOptions?: {
    [lineId: string]: string // lineId -> leadOptionId mapping
  }
  customizations?: {
    [lineId: string]: {
      material?: string
      finish?: string
      quantity?: number
    }
  }
  checkoutData?: {
    shippingAddress?: any
    billingAddress?: any
    selectedPaymentMethod?: string
  }
  leadContact?: {
    email: string
    phone: string
    fingerprint?: string
    submittedAt: string
  }
  quoteSummary?: {
    totalFiles: number
    processedFiles: number
    estimatedPrice?: number
    estimatedTime?: number | string
  }
  lastActivity: string
  abandonedAt: string
}

const STORAGE_FILE = path.join(process.cwd(), 'data', 'abandoned-quotes.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dir = path.dirname(STORAGE_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Load data from file
async function loadData(): Promise<Map<string, AbandonedQuoteData>> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

// Save data to file
async function saveData(data: Map<string, AbandonedQuoteData>) {
  try {
    await ensureDataDir();
    const obj = Object.fromEntries(data);
    await fs.writeFile(STORAGE_FILE, JSON.stringify(obj, null, 2));
  } catch (error) {
    console.error('Failed to save abandoned quotes:', error);
  }
}

// Storage operations
export const abandonedQuotes = {
  async set(key: string, value: AbandonedQuoteData) {
    const data = await loadData();
    data.set(key, value);
    await saveData(data);
  },

  async get(key: string): Promise<AbandonedQuoteData | undefined> {
    const data = await loadData();
    return data.get(key);
  },

  async has(key: string): Promise<boolean> {
    const data = await loadData();
    return data.has(key);
  },

  async delete(key: string): Promise<boolean> {
    const data = await loadData();
    const result = data.delete(key);
    await saveData(data);
    return result;
  },

  async getAll(): Promise<AbandonedQuoteData[]> {
    const data = await loadData();
    return Array.from(data.values());
  },

  async clear() {
    await saveData(new Map());
  }
};

export type { AbandonedQuoteData }
