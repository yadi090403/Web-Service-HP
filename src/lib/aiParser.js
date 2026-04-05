// AI Parser untuk memahami perintah natural language
export const parseInventoryCommand = (commandText) => {
  const lowerCmd = commandText.toLowerCase();
  
  // Deteksi apakah ini pertanyaan atau perintah inventory
  const isQuestion = lowerCmd.includes('?') || 
                     lowerCmd.includes('apa') || 
                     lowerCmd.includes('berapa') || 
                     lowerCmd.includes('bagaimana') ||
                     lowerCmd.includes('rekomendasi') ||
                     lowerCmd.includes('tips') ||
                     lowerCmd.includes('cara') ||
                     lowerCmd.includes('kenapa') ||
                     lowerCmd.includes('info');
  
  // 1. Deteksi action (tambah/kurangi/set)
  let action = 'unknown';
  if (!isQuestion) {
    if (lowerCmd.includes('tambah') || lowerCmd.includes('add') || lowerCmd.includes('tambahkan')) {
      action = 'add';
    } else if (lowerCmd.includes('kurangi') || lowerCmd.includes('kurang') || lowerCmd.includes('remove')) {
      action = 'remove';
    } else if (lowerCmd.includes('set') || lowerCmd.includes('ubah') || lowerCmd.includes('jadikan') || lowerCmd.includes('atur')) {
      action = 'set';
    } else if (lowerCmd.includes('hapus') || lowerCmd.includes('delete')) {
      action = 'delete';
    }
  }
  
  // 2. Ekstrak item (model LCD)
  let item = null;
  
  // Pattern untuk iPhone
  const iphoneMatch = commandText.match(/iPhone\s+[\w\s]+?(?=\s+\d+\s|$|kualitas|quality|pcs|unit|buah|\?|$)/i);
  if (iphoneMatch) item = iphoneMatch[0].trim();
  
  // Pattern untuk Samsung
  if (!item) {
    const samsungMatch = commandText.match(/Samsung\s+[\w\s]+?(?=\s+\d+\s|$|kualitas|quality|pcs|unit|buah|\?|$)/i);
    if (samsungMatch) item = samsungMatch[0].trim();
  }
  
  // Pattern untuk Xiaomi
  if (!item) {
    const xiaomiMatch = commandText.match(/Xiaomi\s+[\w\s]+?(?=\s+\d+\s|$|kualitas|quality|pcs|unit|buah|\?|$)/i);
    if (xiaomiMatch) item = xiaomiMatch[0].trim();
  }
  
  // Pattern untuk Oppo
  if (!item) {
    const oppoMatch = commandText.match(/Oppo\s+[\w\s]+?(?=\s+\d+\s|$|kualitas|quality|pcs|unit|buah|\?|$)/i);
    if (oppoMatch) item = oppoMatch[0].trim();
  }
  
  // Pattern untuk Vivo
  if (!item) {
    const vivoMatch = commandText.match(/Vivo\s+[\w\s]+?(?=\s+\d+\s|$|kualitas|quality|pcs|unit|buah|\?|$)/i);
    if (vivoMatch) item = vivoMatch[0].trim();
  }
  
  // Pattern generic LCD
  if (!item && lowerCmd.includes('lcd')) {
    const lcdMatch = commandText.match(/LCD\s+([A-Za-z0-9\s]+?)(?=\s+\d+\s|$|kualitas|\?|$)/i);
    if (lcdMatch) item = lcdMatch[1].trim();
  }
  
  // 3. Ekstrak quantity
  let quantity = null;
  const qtyRegex = /(\d+)\s*(pcs|pc|unit|buah)/i;
  const qtyMatch = commandText.match(qtyRegex);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
  } else {
    const simpleNum = commandText.match(/\b(\d+)\b/);
    if (simpleNum && !simpleNum[1].match(/^[0-9]{4}/)) {
      quantity = parseInt(simpleNum[1], 10);
    }
  }
  
  if (!quantity && !isQuestion) quantity = 1;
  
  // 4. Ekstrak kualitas
  let quality = 'Original';
  if (lowerCmd.includes('original') || lowerCmd.includes('ori')) quality = 'Original';
  else if (lowerCmd.includes('high quality') || lowerCmd.includes('high') || lowerCmd.includes('premium')) quality = 'High Quality';
  else if (lowerCmd.includes('medium') || lowerCmd.includes('standar')) quality = 'Medium';
  else if (lowerCmd.includes('standard')) quality = 'Standard';
  
  return { action, item: item ? item.charAt(0).toUpperCase() + item.slice(1) : null, quantity, quality, isQuestion };
};

// Knowledge Base untuk pertanyaan tentang LCD dan HP
export const getAIResponse = async (question, inventory = []) => {
  const lowerQ = question.toLowerCase();
  
  // 1. Pertanyaan tentang stok tertentu
  const stockMatch = lowerQ.match(/(?:stok|berapa|tersedia)\s+(?:lcd\s+)?([a-z0-9\s]+)/i);
  if (stockMatch && (lowerQ.includes('stok') || lowerQ.includes('berapa'))) {
    const modelQuery = stockMatch[1].trim();
    const foundItems = inventory.filter(item => 
      item.item.toLowerCase().includes(modelQuery.toLowerCase())
    );
    
    if (foundItems.length > 0) {
      let response = `📊 Stok LCD untuk ${modelQuery}:\n`;
      foundItems.forEach(item => {
        response += `• ${item.item} (${item.quality}): ${item.quantity} pcs\n`;
      });
      return response;
    } else {
      return `📭 Maaf, stok LCD untuk "${modelQuery}" tidak ditemukan. Coba cek model lain ya!`;
    }
  }
  
  // 2. TYPE LCD YANG SAMA/KOMPATEBEL
  if (lowerQ.includes('rekomendasi') || lowerQ.includes('rekomendasi lcd') || lowerQ.includes('lcd bagus')) {
    const d = `-----------------------------`;
    return `💡 TYPE LCD YANG SAMA/KOMPATEBEL:

  📱 HP-Redmi Entry-Level (6.53” HD+ IPS): 
  • Redmi 9A
  • Redmi 9C
  • Redmi 10A
  • POCO C31
  ${d}
  📱 HP-Redmi Note 8 Series:
  • Redmi Note 8
  • Redmi Note 8T
  ${d}
  📱 HP-Redmi Note 9 Series
  • Redmi Note 9
  • Redmi 10X 4G
  ${d}
  📱 HP-OPPO A Series – Realme C Series
  • OPPO A5s
  • OPPO A7
  • OPPO A12
  • Realme 3
  • Realme C3
  • Realme C11 (beberapa versi)
  ${d}
  📱 HP-OPPO A3s
  • OPPO A5s
  • OPPO A3s
  • OPPO A5 (2018 / AX5)
  • Realme C1
  • Realme 2
  ${d}
  📱 HP-OPPO F7
  • OPPO A3
  • OPPO F7 Pro
  ${d}
  📱 HP-OPPO A1K
  • Realme C2
  ${d}
  📱 HP-OPPO 17K
  • OPPO A17
  • OPPO A18
  • OPPO A77s
  • OPPO A57
  • OPPO A78 5G
  • OPPO A38
  • OPPO A59 5G
  ${d}
  📱 HP-OPPO A60
  • Realme C65 (4G/5G)
  • Realme 12x 5G
  • Narzo N65 5G
  • Oppo A3pro 5G
  • Oppo A3x 
  ${d}
  📱 HP-Samsung Galaxy A30 Series
  • Samsung Galaxy A30
  • Samsung Galaxy A30s
  ${d}
  📱 HP-Samsung Galaxy A10 Series
  • Samsung Galaxy A10
  • Samsung Galaxy A10s
  ${d}
  📱 HP-Infinix Smart / Hot Series
  • Infinix Smart 5
  • Infinix Hot 10 Lite
  • Tecno Spark 6 Go
  ${d}
  📱 HP-Infinix Hot 9 Series
  • Infinix Hot 9
  • Infinix Hot 9 Play
  ${d}
  📱 HP-Vivo Y Series
  • Vivo Y12
  • Vivo Y15
  • Vivo Y17
  ${d}
  📱 HP-iPhone 6 Series
  • iPhone 6
  • iPhone 6G
  • iPhone 6s
  • iPhone 6s Plus
  ${d}
  📱 HP-iPhone 7 Series
  • iPhone 7
  • iPhone 7 Plus

  💡 Tips: Original = kualitas terbaik, High Quality = value terbaik, Medium = budget friendly`;
  }
  
  // 3. Tips perawatan LCD
  if (lowerQ.includes('tips') || lowerQ.includes('perawatan') || lowerQ.includes('cara merawat')) {
    return `🛡️ **Tips Merawat LCD HP:**

1. Gunakan **screen protector** tempered glass
2. Hindari benturan dan tekanan berlebih
3. Jauhkan dari suhu ekstrem (panas/dingin)
4. Bersihkan dengan kain mikrofiber
5. Hindari cairan kimia seperti alkohol
6. Gunakan casing yang melindungi sisi layar
7. Jangan tidur dengan HP di bawah bantal

✨ Dengan perawatan yang baik, LCD bisa awet 2-3 tahun lebih!`;
  }
  
  // 4. Perbedaan kualitas LCD
  if (lowerQ.includes('kualitas') || lowerQ.includes('perbedaan') || lowerQ.includes('jenis')) {
    return `🏷️ **Perbedaan Kualitas LCD:**

🔴 **Original** - Kualitas pabrik, garansi resmi, harga termahal
🟠 **High Quality** - Kualitas mendekati original, garansi toko, harga menengah
🟡 **Medium** - Kualitas standar, warna agak kurang tajam, harga ekonomis
⚪ **Standard** - Kualitas basic, untuk penggunaan ringan, harga termurah

💡 Rekomendasi: Untuk HP flagship pakai Original, untuk HP mid-range High Quality sudah cukup.`;
  }
  
  // 5. Kompatibilitas LCD
  if (lowerQ.includes('kompatibel') || lowerQ.includes('compatible') || lowerQ.includes('cocok')) {
    const modelMatch = lowerQ.match(/(?:untuk|dengan)\s+([a-z0-9\s]+)/i);
    if (modelMatch) {
      const model = modelMatch[1].trim();
      return `🔍 **Kompatibilitas LCD untuk ${model}:**

✅ LCD khusus ${model} harus sesuai dengan tipe konektor
⚠️ Jangan gunakan LCD dari model lain walau merk sama
💡 Pastikan membeli LCD dengan kode model yang sama persis

Ada stok untuk ${model}? Coba tanya "stok ${model}"`;
    }
    return `🔍 **Cek Kompatibilitas LCD:**

Setiap HP memiliki LCD dengan konektor yang berbeda. Pastikan:
1. Model persis sama (contoh: iPhone 12 ≠ iPhone 12 Pro)
2. Tipe konektor (JDI, Sharp, dll) sesuai
3. Beli di toko terpercaya yang menjamin kompatibilitas

Ada model yang mau dicek? Sebutkan saja!`;
  }
  
  // 6. Informasi tentang merk tertentu
  if (lowerQ.includes('iphone')) {
    return `📱 **Info LCD iPhone:**

• iPhone X-11-12-13-14 series menggunakan OLED (kecuali XR/11 = LCD)
• Harga LCD Original iPhone: mulai Rp 500.000 - Rp 3.000.000
• LCD iPhone paling awet: Original dan High Quality
• Stok iPhone: ${inventory.filter(i => i.item.includes('iPhone')).length} varian tersedia

Butuh stok tertentu? Coba tanya "stok iPhone 12"`;
  }
  
  if (lowerQ.includes('samsung')) {
    return `📱 **Info LCD Samsung:**

• Samsung A series (A01-A73): kebanyakan menggunakan PLS LCD
• Samsung S series (S20-S23): menggunakan Dynamic AMOLED
• Harga LCD Samsung: mulai Rp 200.000 - Rp 2.500.000
• Stok Samsung: ${inventory.filter(i => i.item.includes('Samsung')).length} varian tersedia

Butuh stok tertentu? Coba tanya "stok Samsung A52"`;
  }
  
  if (lowerQ.includes('xiaomi')) {
    return `📱 **Info LCD Xiaomi:**

• Redmi Note series: LCD IPS yang cukup tahan lama
• Mi series: AMOLED dengan kualitas warna bagus
• Harga LCD Xiaomi: mulai Rp 150.000 - Rp 1.500.000
• Stok Xiaomi: ${inventory.filter(i => i.item.includes('Xiaomi')).length} varian tersedia

Butuh stok tertentu? Coba tanya "stok Redmi Note 10"`;
  }
  
  // 7. Salam dan sapaan
  if (lowerQ.includes('halo') || lowerQ.includes('hai') || lowerQ.includes('hello') || lowerQ.includes('assalamu')) {
    return `👋 Halo! Saya AI Assistant khusus LCD HP. Ada yang bisa dibantu?

Saya bisa:
• Cek stok LCD (contoh: "stok iPhone 12")
• Rekomendasi LCD terbaik
• Tips perawatan LCD
• Info perbedaan kualitas LCD
• Cek kompatibilitas

Atau mau mengelola stok? Coba "tambah iPhone 13 5 pcs Original"`;
  }
  
  // 8. Bantuan / help
  if (lowerQ.includes('bantuan') || lowerQ.includes('help') || lowerQ.includes('cara pakai')) {
    return `🤖 **Cara Menggunakan AI Assistant:**

📝 **Manajemen Stok:**
• Tambah: "tambah iPhone 12 5 pcs Original"
• Kurangi: "kurangi Samsung A52 2 pcs"
• Set: "set iPhone 11 menjadi 10 pcs"
• Hapus: "hapus Oppo Reno 6"

💬 **Tanya Jawab:**
• Cek stok: "stok iPhone 12 Pro Max"
• Rekomendasi: "rekomendasi lcd bagus"
• Tips: "tips merawat lcd hp"
• Info merk: "info lcd iphone"
• Kualitas: "perbedaan kualitas lcd"

Ada yang ingin ditanyakan? 😊`;
  }
  
  // 9. Default response untuk pertanyaan lain
  if (lowerQ.includes('?') || lowerQ.includes('apa') || lowerQ.includes('bagaimana')) {
    return `🤔 Maaf, saya belum mengerti pertanyaan itu. Coba tanyakan:

• "stok iPhone 12" → cek stok
• "rekomendasi lcd" → rekomendasi
• "tips perawatan lcd" → tips
• "perbedaan kualitas lcd" → info kualitas
• "bantuan" → semua perintah

Atau jika ingin mengelola stok, gunakan: tambah, kurangi, set, atau hapus.`;
  }
  
  return null; // Bukan pertanyaan, akan diproses sebagai perintah inventory
};