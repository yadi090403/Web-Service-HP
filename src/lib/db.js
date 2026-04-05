import { openDB } from 'idb';

const DB_NAME = 'aiLCDAssistantDB';
const DB_VERSION = 4; // Added harga_lcd store
const STORE_NAME = 'inventory';
const PRICE_STORE_NAME = 'harga_lcd';

// Inisialisasi database
export const initDB = async () => {
  try {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        const tx = transaction.transaction;
        
        // Migrate inventory store if upgrading from older version
        if (oldVersion < 3 && db.objectStoreNames.contains(STORE_NAME)) {
          tx.deleteObjectStore(STORE_NAME);
        }
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // Create/update inventory store
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('item', 'item');
          store.createIndex('quality', 'quality');
          store.createIndex('item_quality', ['item', 'quality']);
        }
        
        // Create/update harga_lcd store (new in v4)
        if (!db.objectStoreNames.contains(PRICE_STORE_NAME)) {
          const priceStore = db.createObjectStore(PRICE_STORE_NAME, {
            keyPath: 'lcd_model',
          });
          priceStore.createIndex('harga_jual', 'harga_jual');
          priceStore.createIndex('harga_beli', 'harga_beli');
        }
      },
    });
  } catch (error) {
    console.error('Failed to initialize DB:', error);
    throw error;
  }
};

// Ambil semua data inventory dengan sorting A-Z berdasarkan item
export const getAllInventory = async () => {
  try {
    const db = await initDB();
    const allData = await db.getAll(STORE_NAME);
    // Sort A-Z berdasarkan nama item
    return allData.sort((a, b) => a.item.localeCompare(b.item, 'id', { sensitivity: 'base' }));
  } catch (error) {
    console.error('Error in getAllInventory:', error);
    return [];
  }
};

// Tambah item baru
export const addInventoryItem = async (item) => {
  const db = await initDB();
  const existing = await db.getFromIndex(STORE_NAME, 'item_quality', [item.item, item.quality]);
  
  if (existing) {
    throw new Error(`Item "${item.item}" dengan kualitas "${item.quality}" sudah ada! Gunakan fitur update.`);
  }
  
  const id = await db.add(STORE_NAME, item);
  return { ...item, id };
};

// Update stok (tambah/kurang)
export const updateStock = async (itemName, quality, quantity, isAdd = true) => {
  const db = await initDB();
  const existing = await db.getFromIndex(STORE_NAME, 'item_quality', [itemName, quality]);
  
  if (!existing) {
    throw new Error(`Item "${itemName}" dengan kualitas "${quality}" tidak ditemukan`);
  }
  
  if (isAdd) {
    existing.quantity += quantity;
  } else {
    if (existing.quantity < quantity) {
      throw new Error(`Stok tidak cukup! Tersisa ${existing.quantity} pcs`);
    }
    existing.quantity -= quantity;
  }
  
  await db.put(STORE_NAME, existing);
  
  if (existing.quantity === 0) {
    await db.delete(STORE_NAME, existing.id);
    return { deleted: true, item: existing };
  }
  
  return { updated: true, item: existing };
};

// Set stok exact
export const setExactStock = async (itemName, quality, quantity) => {
  const db = await initDB();
  const existing = await db.getFromIndex(STORE_NAME, 'item_quality', [itemName, quality]);
  
  if (quantity === 0) {
    if (existing) {
      await db.delete(STORE_NAME, existing.id);
      return { deleted: true, item: existing };
    }
    return { deleted: false };
  }
  
  if (existing) {
    existing.quantity = quantity;
    await db.put(STORE_NAME, existing);
    return { updated: true, item: existing };
  } else {
    const newItem = { item: itemName, quantity, quality };
    const id = await db.add(STORE_NAME, newItem);
    return { added: true, item: { ...newItem, id } };
  }
};

// Hapus item
export const deleteInventoryItem = async (id) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
  return true;
};

// Clear semua data
export const clearAllData = async () => {
  const db = await initDB();
  const allKeys = await db.getAllKeys(STORE_NAME);
  for (const key of allKeys) {
    await db.delete(STORE_NAME, key);
  }
};

// Seed data awal inventory (sudah diurutkan A-Z)
export const seedInitialData = async () => {
  try {
    const existingData = await getAllInventory();
    if (existingData.length === 0) {
      const initialData = [
      ];
      
      const db = await initDB();
      for (const data of initialData) {
        await db.add(STORE_NAME, data);
      }
      console.log('Seed inventory berhasil ditambahkan');
    }
  } catch (error) {
    console.error('Seed initial data failed:', error);
  }
};

// Seed harga_lcd data
export const seedInitialPrices = async () => {
  try {
    const db = await initDB();
    const existingPrices = await db.getAll(PRICE_STORE_NAME);
    
    if (existingPrices.length === 0) {
      const initialPrices = [
      ];
      
      for (const price of initialPrices) {
        await db.put(PRICE_STORE_NAME, price);
      }
      console.log('Seed harga_lcd berhasil ditambahkan');
    }
  } catch (error) {
    console.error('Seed initial prices failed:', error);
  }
};

// Get all prices, sorted by harga_jual desc
export const getAllPrices = async () => {
  const db = await initDB();
  const allPrices = await db.getAll(PRICE_STORE_NAME);
  return allPrices.sort((a, b) => b.harga_jual - a.harga_jual);
};

// Add/update price (uses lcd_model as keyPath)
export const upsertPrice = async (priceData) => {
  const db = await initDB();
  priceData.updated_at = new Date().toISOString();
  
  // Check if exists first (for upsert logic)
  const existing = await db.get(PRICE_STORE_NAME, priceData.lcd_model);
  if (existing) {
    await db.put(PRICE_STORE_NAME, priceData);
    return { updated: true, price: priceData };
  } else {
    await db.put(PRICE_STORE_NAME, priceData);
    return { added: true, price: priceData };
  }
};

// Delete price by lcd_model
export const deletePrice = async (lcd_model) => {
  const db = await initDB();
  await db.delete(PRICE_STORE_NAME, lcd_model);
  return true;
};

// Get price by lcd_model
export const getPriceByModel = async (lcd_model) => {
  const db = await initDB();
  return await db.get(PRICE_STORE_NAME, lcd_model);
};
