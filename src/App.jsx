import React, { useState, useEffect, useRef } from 'react';
import { 
  getAllInventory, 
  getAllPrices,
  seedInitialData, 
  seedInitialPrices,
  updateStock, 
  setExactStock,
  deleteInventoryItem,
  clearAllData,
  addInventoryItem,
  upsertPrice,
  deletePrice
} from './lib/db';
import { parseInventoryCommand, getAIResponse } from './lib/aiParser';

function App() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState('');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);

  // State untuk modal edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editQuality, setEditQuality] = useState('');

  // State untuk modal create (tambah item baru)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    item: '',
    quantity: '',
    quality: 'Original'
  });

// State untuk chat history
  const [chatHistory, setChatHistory] = useState([]);
  // New states for improved chat UI
  const [compactView, setCompactView] = useState(true);
  const chatEndRef = useRef(null);

  // Price states
  const [prices, setPrices] = useState([]);
const [loadingPrices, setLoadingPrices] = useState(false);

  // Price modal states
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [newPrice, setNewPrice] = useState({
    lcd_model: '',
    harga_beli: '',
    harga_jual: ''
  });

  // Load inventory data
  const loadInventoryData = async () => {
    try {
      await seedInitialData();
      const data = await getAllInventory();
      setInventory(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  // Load prices data
  const loadPricesData = async () => {
    try {
      setLoadingPrices(true);
      await seedInitialPrices();
      const priceData = await getAllPrices();
      setPrices(priceData);
    } catch (error) {
      console.error('Error loading prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  // Load all data
  const loadData = async () => {
    await Promise.all([loadInventoryData(), loadPricesData()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cleanup for response timeout
  useEffect(() => {
    if (response) {
      const timeoutId = setTimeout(() => {
        setResponse('');
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [response]);

  // Auto-scroll to latest chat message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Handle AI Command
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!command.trim()) {
      setResponse('⚠️ Masukkan perintah atau pertanyaan untuk AI Assistant');
      return;
    }

    setProcessing(true);
    setResponse('');

    try {
      const parsed = parseInventoryCommand(command);
      const { action, item, quantity, quality, isQuestion } = parsed;

      let message = '';
      let isChatResponse = false;

      // Jika ini adalah pertanyaan (bukan perintah inventory)
      if (isQuestion || (!action && command.includes('?')) || 
          command.toLowerCase().includes('apa') || 
          command.toLowerCase().includes('berapa') ||
          command.toLowerCase().includes('tips') ||
          command.toLowerCase().includes('rekomendasi')) {
        
        const aiResponse = await getAIResponse(command, inventory);
        if (aiResponse) {
          message = aiResponse;
          isChatResponse = true;
        } else {
          message = "🤔 Maaf, saya belum mengerti. Ketik 'bantuan' untuk melihat perintah yang tersedia.";
          isChatResponse = true;
        }
      } else if (action !== 'unknown') {
        let result;

        if (action === 'add') {
          result = await updateStock(item, quality, quantity, true);
          message = `✅ Berhasil menambah ${quantity} pcs ${item} (${quality})`;
          if (result.updated) {
            message += `. Stok sekarang: ${result.item.quantity} pcs`;
          }
        } else if (action === 'remove') {
          try {
            result = await updateStock(item, quality, quantity, false);
            if (result.deleted) {
              message = `🗑️ Berhasil mengurangi ${quantity} pcs ${item} (${quality}). Stok habis, item dihapus.`;
            } else {
              message = `✅ Berhasil mengurangi ${quantity} pcs ${item} (${quality}). Sisa stok: ${result.item.quantity} pcs`;
            }
          } catch (error) {
            message = `❌ ${error.message}`;
          }
        } else if (action === 'set') {
          result = await setExactStock(item, quality, quantity);
          if (result.added) {
            message = `✨ Item baru ditambahkan: ${item} (${quality}) dengan stok ${quantity} pcs`;
          } else if (result.updated) {
            message = `✏️ Stok ${item} (${quality}) diperbarui menjadi ${quantity} pcs`;
          } else if (result.deleted) {
            message = `🔄 Stok ${item} (${quality}) diatur ke 0, item dihapus`;
          }
        } else if (action === 'delete') {
          const itemToDelete = inventory.find(i => 
            i.item.toLowerCase().includes(item?.toLowerCase() || '')
          );
          if (itemToDelete) {
            await deleteInventoryItem(itemToDelete.id);
            message = `🗑️ Item "${itemToDelete.item} (${itemToDelete.quality})" telah dihapus`;
          } else {
            message = `❌ Item "${item}" tidak ditemukan`;
          }
        }
      } else {
        message = "🤔 Maaf, perintah tidak dikenali. Ketik 'bantuan' untuk melihat contoh perintah.\\n\\n💬 Atau tanyakan sesuatu seperti:\\n• stok iPhone 12\\n• rekomendasi lcd\\n• tips perawatan lcd";
      }

      setResponse(message);

      // Tambahkan ke chat history
      setChatHistory(prev => [
        ...prev,
        { 
          id: Date.now(), 
          user: command, 
          ai: message, 
          timestamp: new Date().toLocaleTimeString(),
          isChat: isChatResponse 
        }
      ]);

      // Reload data hanya jika ada perubahan inventory
      if (!isChatResponse && (action === 'add' || action === 'remove' || action === 'set' || action === 'delete')) {
        const freshData = await getAllInventory();
        setInventory(freshData);
      }
    } catch (error) {
      const errorMsg = `❌ Error: ${error.message}`;
      setResponse(errorMsg);
      setChatHistory(prev => [
        ...prev,
        { 
          id: Date.now(), 
          user: command, 
          ai: errorMsg, 
          timestamp: new Date().toLocaleTimeString(),
          isChat: false 
        }
      ]);
    } finally {
      setProcessing(false);
      setCommand('');
    }
  };

  // Handle delete item
  const handleDelete = async (id, itemName, quality) => {
    if (window.confirm(`Hapus ${itemName} (${quality}) dari daftar?`)) {
      await deleteInventoryItem(id);
      const freshData = await getAllInventory();
      setInventory(freshData);
      setResponse(`🗑️ Item "${itemName} (${quality})" telah dihapus`);
    }
  };

  // Handle edit
  const handleEdit = (item) => {
    setEditingItem(item);
    setEditQuantity(item.quantity.toString());
    setEditQuality(item.quality);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const newQuantity = parseInt(editQuantity, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
      setResponse('❌ Jumlah stok tidak valid!');
      return;
    }

    try {
      await setExactStock(editingItem.item, editQuality, newQuantity);
      const freshData = await getAllInventory();
      setInventory(freshData);
      setResponse(`✏️ Berhasil mengupdate ${editingItem.item} (${editQuality}) menjadi ${newQuantity} pcs`);
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      setResponse(`❌ Error: ${error.message}`);
    }
  };

  // Handle create new item
  const handleCreateItem = async () => {
    if (!newItem.item.trim()) {
      setResponse('❌ Nama model LCD harus diisi!');
      return;
    }

    const quantity = parseInt(newItem.quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      setResponse('❌ Jumlah stok harus lebih dari 0!');
      return;
    }

    try {
      const existing = inventory.find(
        i => i.item === newItem.item.trim() && i.quality === newItem.quality
      );

      if (existing) {
        setResponse(`⚠️ Item "${newItem.item} (${newItem.quality})" sudah ada!`);
        return;
      }

      await addInventoryItem({
        item: newItem.item.trim(),
        quantity: quantity,
        quality: newItem.quality
      });

      const freshData = await getAllInventory();
      setInventory(freshData);
      setResponse(`✅ Berhasil menambahkan item baru: ${newItem.item} (${newItem.quality}) sebanyak ${quantity} pcs`);

      setNewItem({ item: '', quantity: '', quality: 'Original' });
      setIsCreateModalOpen(false);
    } catch (error) {
      setResponse(`❌ Error: ${error.message}`);
    }
  };

  // Handle reset database
  const handleReset = async () => {
    if (window.confirm('⚠️ RESET DATABASE: Semua data stok & harga akan dihapus. Lanjutkan?')) {
      await clearAllData();
      await seedInitialData();
      await seedInitialPrices();
      const freshInventory = await getAllInventory();
      const freshPrices = await getAllPrices();
      setInventory(freshInventory);
      setPrices(freshPrices);
      setResponse('🔄 Database stok & harga telah direset');
    }
  };

  // Price handlers
  const handleSavePrice = async () => {
    if (!newPrice.lcd_model.trim() || !newPrice.harga_beli || !newPrice.harga_jual) {
      setResponse('❌ Semua field harga wajib diisi!');
      return;
    }

    const hargaBeli = parseInt(newPrice.harga_beli, 10);
    const hargaJual = parseInt(newPrice.harga_jual, 10);
    if (isNaN(hargaBeli) || isNaN(hargaJual) || hargaBeli <= 0 || hargaJual <= 0) {
      setResponse('❌ Harga harus angka positif!');
      return;
    }

    try {
      const result = await upsertPrice({
        lcd_model: newPrice.lcd_model.trim(),
        harga_beli: hargaBeli,
        harga_jual: hargaJual
      });

      const freshPrices = await getAllPrices();
      setPrices(freshPrices);

      if (result.added) {
        setResponse(`✅ Harga baru ${newPrice.lcd_model}: Beli Rp${hargaBeli.toLocaleString()}, Jual Rp${hargaJual.toLocaleString()}`);
      } else {
        setResponse(`✏️ Harga ${newPrice.lcd_model} diupdate: Beli Rp${hargaBeli.toLocaleString()}, Jual Rp${hargaJual.toLocaleString()}`);
      }

      setIsPriceModalOpen(false);
      setNewPrice({ lcd_model: '', harga_beli: '', harga_jual: '' });
    } catch (error) {
      setResponse(`❌ Error: ${error.message}`);
    }
  };

  const handleEditPrice = (price) => {
    setEditingPrice(price);
    setNewPrice({
      lcd_model: price.lcd_model,
      harga_beli: price.harga_beli.toString(),
      harga_jual: price.harga_jual.toString()
    });
    setIsPriceModalOpen(true);
  };

  const handleDeletePrice = async (lcd_model) => {
    if (window.confirm(`Hapus harga ${lcd_model}?`)) {
      await deletePrice(lcd_model);
      const freshPrices = await getAllPrices();
      setPrices(freshPrices);
      setResponse(`🗑️ Harga ${lcd_model} dihapus`);
    }
  };

  const quickCommands = [
    { text: 'rekomendasi lcd', label: '💡 Type LCD' },
    { text: 'tips perawatan lcd', label: '🛡️ Tips' },
    { text: 'bantuan', label: '❓ Bantuan' },
  ];

  const handleQuickCommand = (cmdText) => {
    setCommand(cmdText);
  };

  const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const originalCount = inventory.filter(i => i.quality === 'Original').length;
  const totalProfit = prices.reduce((sum, p) => sum + (p.harga_jual - p.harga_beli), 0);
  // const mostExpensive = prices.length > 0 ? prices[0] : null; // unused

  const getQualityColor = (quality) => {
    switch(quality) {
      case 'Original': return 'bg-emerald-100 text-emerald-800';
      case 'High Quality': return 'bg-blue-100 text-blue-800';
      case 'Medium': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format message untuk multi-line readability
  const formatMessage = (text) => {
    return text.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto border-4 rounded-full animate-spin border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 font-medium text-white">Memuat data LCD...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl blur-2xl opacity-20"></div>
          <div className="relative p-6 shadow-xl bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="flex items-center gap-3 text-3xl font-bold text-white md:text-4xl">
                  <span className="text-4xl">🔧</span>
                  WEB LCD GUSAIRI
                </h1>
                <p className="mt-2 text-sm text-slate-300 md:text-base">
                  Manajemen Inventaris Cerdas berbasis AI | CRUD Full
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-md bg-emerald-500 hover:bg-emerald-600"
                >
                  ➕ Tambah Item
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all rounded-lg bg-white/10 hover:bg-white/20"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
          <div className="p-5 bg-white border shadow-sm rounded-xl border-slate-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Item</p>
                <p className="mt-1 text-3xl font-bold text-slate-800">{inventory.length}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-100">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="p-5 bg-white border shadow-sm rounded-xl border-slate-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Stok</p>
                <p className="mt-1 text-3xl font-bold text-slate-800">{totalStock}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border shadow-sm rounded-xl border-slate-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Profit</p>
                <p className="mt-1 text-3xl font-bold text-slate-800">Rp{totalProfit.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border shadow-sm rounded-xl border-slate-200 hover:shadow-md md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Original Items</p>
                <p className="mt-1 text-3xl font-bold text-slate-800">{originalCount}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-100">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* AI Command */}
        <div className="mb-8 bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white border-slate-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <span className="text-xl">🤖</span>
              AI Command Center
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <textarea
              rows="3"
              className="w-full px-4 py-3 border resize-none border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Contoh: &#10;tambah iPhone 12 5 pcs Original&#10;kurangi Samsung A52 2 pcs&#10;stok iPhone&#10;rekomendasi lcd&#10;bantuan"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={processing}
            />
            <div className="flex flex-wrap gap-2 mt-4">
              {quickCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickCommand(cmd.text)}
                  className="px-3 py-1 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={processing}
              className={`w-full mt-4 py-3 font-semibold text-white rounded-xl flex items-center justify-center gap-2 ${
                processing 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:shadow-lg shadow-md'
              }`}
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent" />
                  Memproses...
                </>
              ) : (
                <>🚀 Jalankan Perintah AI</>
              )}
            </button>
          </form>

          {response && (
            <div className={`mx-6 p-4 rounded-xl mb-6 ${
              response.includes('✅') || response.includes('✨') || response.includes('✏️') 
                ? 'bg-emerald-50 border border-emerald-200' 
                : response.includes('❌') || response.includes('⚠️')
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <p className="text-sm text-slate-700">{response}</p>
            </div>
          )}

          {/* ✅ IMPROVED Riwayat Percakapan - Multi-line readable */}
          {chatHistory.length > 0 && (
            <div className="p-6 mx-6 mb-6 space-y-6 overflow-y-auto border shadow-sm rounded-2xl bg-gradient-to-b from-slate-50/80 to-white/50 backdrop-blur-sm border-slate-200">
              {/* Header with toggle */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  💬 Riwayat Percakapan ({chatHistory.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCompactView(!compactView)}
                    className="px-3 py-1 text-xs font-medium transition-all rounded-full text-slate-600 bg-slate-200 hover:bg-slate-300"
                    title={compactView ? "Lihat Lengkap" : "Kompak"}
                  >
                    {compactView ? "📖 Lengkap" : "📱 Kompak"}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Hapus semua riwayat?')) setChatHistory([]);
                    }}
                    className="p-1 transition-all rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                    title="Hapus Riwayat"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div 
                className={`space-y-4 pr-2 ${compactView ? 'max-h-60' : 'max-h-[500px]'} [&>*]:animate-fadeIn`}
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
              >
                {chatHistory.slice(-20).reverse().map((chat, index) => (
                  <div key={chat.id} ref={chatHistory.length - 1 === index ? chatEndRef : null}>
                    {/* User Message - Right aligned, multi-line */}
                    <div className="flex justify-end group">
                      <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
                        {/* User avatar */}
                        <div className="flex items-center self-end justify-center flex-shrink-0 w-8 h-8 rounded-full shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
                          <span className="text-xs font-bold text-white">U</span>
                        </div>
                        {/* User bubble */}
                        <div className="max-w-full p-3 text-sm leading-relaxed text-left text-white break-words transition-all duration-200 rounded-tr-sm shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl group-hover:shadow-xl max-h-32">
                          {formatMessage(chat.user)}
                          <div className="mt-2.5 text-xs opacity-80 font-medium">{chat.timestamp}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* AI Message - Left aligned, multi-line */}
                    <div className="flex justify-start group">
                      <div className="flex gap-3 max-w-[100%] sm:max-w-[95%]">
                        {/* AI avatar */}
                        <div className="flex items-center self-end justify-center flex-shrink-0 w-8 h-8 rounded-full shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                          <span className="text-xs font-bold text-white">🤖</span>
                        </div>
                        {/* AI bubble with conditional styling */}
                        <div className={`p-3 rounded-2xl rounded-tl-sm shadow-lg group-hover:shadow-xl transition-all duration-200 text-sm leading-6 text-left break-words${
                          chat.ai.includes('✅') || chat.ai.includes('✨') 
                            ? 'bg-gradient-to-r from-emerald-50/90 to-emerald-100/90 border border-emerald-200/50 text-emerald-900' 
                            : chat.ai.includes('❌') 
                            ? 'bg-gradient-to-r from-red-50/90 to-red-100/90 border border-red-200/50 text-red-900' 
                            : 'bg-gradient-to-r from-slate-100/90 to-slate-200/90 border border-slate-200/50 text-slate-900'
                        }`}>
                          {formatMessage(chat.ai)}
                          <div className="pt-2 mt-2 text-xs font-medium border-t border-slate-300/100 opacity-70">
                            {chat.timestamp}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Inventory Table */}
        <div className="mb-6 bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-100 border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">📦 Data Inventory LCD ({inventory.length} items)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-left uppercase text-slate-500">Model</th>
                  <th className="px-6 py-4 text-xs font-semibold text-left uppercase text-slate-500">Kualitas</th>
                  <th className="px-6 py-4 text-xs font-semibold text-left uppercase text-slate-500">Stok</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Harga Jual</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                      📭 Belum ada data stok. Gunakan AI command atau tombol Tambah Item!
                    </td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{item.item}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQualityColor(item.quality)}`}>
                          {item.quality}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.quantity} pcs</td>
                      <td className="px-6 py-4 text-right">
                        {prices.find(p => p.lcd_model === item.item) ? (
                          <span className="font-semibold text-emerald-600">
                            Rp{((prices.find(p => p.lcd_model === item.item)?.harga_jual || 0) * item.quantity).toLocaleString()}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Rp -</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(item)} className="p-2 text-blue-500 rounded-lg hover:bg-blue-50">
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(item.id, item.item, item.quality)} className="p-2 text-red-500 rounded-lg hover:bg-red-50">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prices Table */}
        <div className="bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-emerald-50 border-slate-200">
            <h2 className="text-lg font-semibold text-emerald-800">💰 Tabel Harga LCD ({prices.length} items)</h2>
            <button onClick={() => setIsPriceModalOpen(true)} className="px-4 py-2 text-xs text-white rounded-lg bg-emerald-600 hover:bg-emerald-700">
              ➕ Tambah
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-left uppercase text-slate-500">Model</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Beli</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Jual</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Profit</th>
                  <th className="px-6 py-4 text-xs font-semibold text-right uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prices.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                      💸 Belum ada data harga. Gunakan tombol Tambah atau AI!
                    </td>
                  </tr>
                ) : (
                  prices.map((price) => (
                    <tr key={price.lcd_model} className="hover:bg-emerald-50/50">
                      <td className="px-6 py-4 font-medium text-slate-800">{price.lcd_model}</td>
                      <td className="px-6 py-4 text-right">Rp{price.harga_beli.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-right text-emerald-600">Rp{price.harga_jual.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          Rp{(price.harga_jual - price.harga_beli).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleEditPrice(price)} className="p-2 text-blue-500 rounded-lg hover:bg-blue-50">✏️</button>
                          <button onClick={() => handleDeletePrice(price.lcd_model)} className="p-2 text-red-500 rounded-lg hover:bg-red-50">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        {isEditModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">✏️ Update {editingItem.item}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-slate-700">Kualitas</label>
                  <select value={editQuality} onChange={(e) => setEditQuality(e.target.value)} className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500">
                    <option value="Original">Original</option>
                    <option value="High Quality">High Quality</option>
                    <option value="Medium">Medium</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-slate-700">Stok (pcs)</label>
                  <input type="number" min="0" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
                <button onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }} className="flex-1 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Batal</button>
                <button onClick={handleSaveEdit} className="flex-1 py-2 font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {isPriceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl">
              <div className="px-6 py-4 border-b bg-emerald-50 border-slate-200">
                <h3 className="text-lg font-semibold text-emerald-800">{editingPrice ? 'Edit Harga' : 'Tambah Harga'}</h3>
              </div>
              <div className="p-6 space-y-4">
                <input type="text" value={newPrice.lcd_model} onChange={(e) => setNewPrice({...newPrice, lcd_model: e.target.value})} placeholder="Model LCD" className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" value={newPrice.harga_beli} onChange={(e) => setNewPrice({...newPrice, harga_beli: e.target.value})} placeholder="Harga Beli" className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
                  <input type="number" value={newPrice.harga_jual} onChange={(e) => setNewPrice({...newPrice, harga_jual: e.target.value})} placeholder="Harga Jual" className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
                <button onClick={() => { setIsPriceModalOpen(false); setEditingPrice(null); setNewPrice({lcd_model: '', harga_beli: '', harga_jual: ''}); }} className="flex-1 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Batal</button>
                <button onClick={handleSavePrice} className="flex-1 py-2 font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">➕ Tambah Item Baru</h3>
              </div>
              <div className="p-6 space-y-4">
                <input type="text" value={newItem.item} onChange={(e) => setNewItem({...newItem, item: e.target.value})} placeholder="Model LCD" className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
                <select value={newItem.quality} onChange={(e) => setNewItem({...newItem, quality: e.target.value})} className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500">
                  <option value="Original">Original</option>
                  <option value="High Quality">High Quality</option>
                  <option value="Medium">Medium</option>
                  <option value="Standard">Standard</option>
                </select>
                <input type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: e.target.value})} placeholder="Stok" className="w-full px-4 py-2 border rounded-lg border-slate-300 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
                <button onClick={() => { setIsCreateModalOpen(false); setNewItem({item: '', quantity: '', quality: 'Original'}); }} className="flex-1 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Batal</button>
                <button onClick={handleCreateItem} className="flex-1 py-2 font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700">Tambah</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
