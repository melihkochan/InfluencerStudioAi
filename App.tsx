
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Character, GeneratedImage, GeneratedVideo } from './types';
import { editImageWithGemini, generateVideoWithVeo, generateQuickImage } from './services/geminiService';
import { supabaseService } from './services/supabaseService';
import { 
  UploadIcon, MagicIcon, DownloadIcon, DeleteIcon, 
  VideoIcon, SunIcon, LeafIcon, SnowIcon, FlowerIcon,
  PlusIcon, UsersIcon, LayoutGridIcon, CameraIcon,
  ChevronDownIcon, ChevronUpIcon, CloseIcon
} from './components/Icons';

const CAMERA_OPTIONS = {
  aspectRatios: ['1:1', '4:3', '16:9', '21:9', '3:4', '4:5', '9:16'],
  angles: ['GÖZ HIZASI', 'YER SEVİYESİ', 'SOLUCAN BAKIŞI', 'ALT AÇI', 'ÜST AÇI', 'KUŞ BAKIŞI', 'DRONE ÇEKİMİ'],
  scales: ['ÇOK YAKIN', 'YAKIN PLAN', 'GÖĞÜS PLAN', 'BEL PLAN', 'BOY PLAN', 'GENEL PLAN', 'UZAK MESAFE'],
  lenses: ['8MM FİSHEYE', '14MM ULTRA', '35MM CLASSİC', '50MM NATURAL', '85MM PORTRAİT', 'ANAMORFİK']
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
      characters: [],
      activeCharacterId: null,
      styleReferenceImage: null,
      videoReferenceImage: null,
    photoPrompt: '',
    videoPrompt: '',
      history: [],
      videoHistory: [],
      archivedImages: [],
      archivedVideos: [],
      isProcessing: false,
      processingType: null,
      activeTab: 'photo',
      activeSeason: 'default',
    quickPrompt: '',
    quickReferenceImage: null,
    quickHistory: [],
      aspectRatio: '9:16',
      cameraAngle: null,
      shotScale: null,
      lensType: null,
      showCameraConfig: false,
    albumFolders: [],
    selectedFolderId: null,
    selectedItems: [],
    isSelectionMode: false,
      error: null,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'photo' | 'video'} | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const charInputRef = useRef<HTMLInputElement>(null);
  const albumCharInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);


  // İlk yüklemede Supabase'den verileri çek
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Supabase'den karakterleri yükle
        const characters = await supabaseService.getCharacters();
        
        // Supabase'den görselleri yükle (quick görseller dahil değil - onlar geçici)
        const images = await supabaseService.getImages(undefined, false);
        const archivedImages = await supabaseService.getImages(undefined, true);
        
        // Supabase'den videoları yükle
        const videos = await supabaseService.getVideos(undefined, false);
        const archivedVideos = await supabaseService.getVideos(undefined, true);

        // Hızlı görseller veritabanına kaydedilmez - sadece geçici state'te tutulur
        // Quick görselleri filtrele (sadece normal görselleri al)
        const regularImages = images.filter(img => img.characterId !== 'quick');

        // Supabase yükleme tamamlandı

        setState(prev => ({
          ...prev,
          characters,
          history: regularImages,
          quickHistory: [], // Hızlı görseller geçici - sayfa yenilendiğinde kaybolur
          archivedImages,
          videoHistory: videos,
          archivedVideos
        }));
      } catch (error) {
        // Veri yükleme hatası
        // Fallback: localStorage'dan yükle
        try {
          const saved = localStorage.getItem('kochan_studio_v15');
          if (saved) {
            const savedData = JSON.parse(saved);
            setState(prev => ({ ...prev, ...savedData }));
          }
        } catch (e) {
          // localStorage yükleme hatası
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // localStorage'a güvenli kaydetme fonksiyonu (fallback için)
  const saveToLocalStorage = (data: AppState, skipStateUpdate = false) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const dataStr = JSON.stringify(data);
      // localStorage limit kontrolü (yaklaşık 5MB)
      if (dataStr.length > 4 * 1024 * 1024) {
        // localStorage limiti yaklaşıyor
        // Arşivlenmiş dosyaları temizle
        const cleanedData = {
          ...data,
          archivedImages: [],
          archivedVideos: []
        };
        const cleanedStr = JSON.stringify(cleanedData);
        if (cleanedStr.length > 4 * 1024 * 1024) {
          // Hala çok büyükse, eski geçmişi de temizle
          const minimalData = {
            ...cleanedData,
            history: data.history.slice(-10), // Son 10 resmi tut
            videoHistory: data.videoHistory.slice(-5) // Son 5 videoyu tut
          };
          localStorage.setItem('kochan_studio_v15', JSON.stringify(minimalData));
          if (!skipStateUpdate) {
            setState(prev => ({
              ...prev,
              ...minimalData,
              error: 'Depolama alanı doldu. Eski dosyalar otomatik temizlendi.'
            }));
          }
        } else {
          localStorage.setItem('kochan_studio_v15', cleanedStr);
          if (!skipStateUpdate) {
            setState(prev => ({
              ...prev,
              archivedImages: [],
              archivedVideos: []
            }));
          }
        }
      } else {
        localStorage.setItem('kochan_studio_v15', dataStr);
      }
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // localStorage kotası aşıldı
        try {
          // Arşivlenmiş dosyaları temizle ve tekrar dene
          const cleanedData = {
            ...data,
            archivedImages: [],
            archivedVideos: []
          };
          const cleanedStr = JSON.stringify(cleanedData);
          localStorage.setItem('kochan_studio_v15', cleanedStr);
          if (!skipStateUpdate) {
            setState(prev => ({
              ...prev,
              archivedImages: [],
              archivedVideos: [],
              error: 'Depolama alanı doldu. Arşiv dosyaları otomatik temizlendi.'
            }));
          }
        } catch (e2) {
          // Hala hata varsa, geçmişi de temizle
          try {
            const minimalData = {
              ...data,
              archivedImages: [],
              archivedVideos: [],
              history: data.history.slice(-5),
              videoHistory: data.videoHistory.slice(-3)
            };
            localStorage.setItem('kochan_studio_v15', JSON.stringify(minimalData));
            if (!skipStateUpdate) {
              setState(prev => ({
                ...prev,
                ...minimalData,
                error: 'Depolama alanı doldu. Eski dosyalar temizlendi. Lütfen gereksiz dosyaları silin.'
              }));
            }
          } catch (e3) {
            // localStorage temizleme başarısız
            // Bu hata artık görünmemeli çünkü localStorage kullanmıyoruz
            // Supabase kullanıldığı için bu durum oluşmamalı
          }
        }
      } else {
        // localStorage kaydetme hatası
        if (!skipStateUpdate) {
          setState(prev => ({
            ...prev,
            error: 'Veri kaydedilemedi: ' + (e.message || 'Bilinmeyen hata')
          }));
        }
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  // localStorage kaydetme artık gerekli değil - Supabase kullanıyoruz
  // Sadece fallback için tutuluyor (Supabase bağlantısı yoksa)
  useEffect(() => {
    // localStorage kaydetme devre dışı - Supabase kullanılıyor
    // Eğer gelecekte fallback gerekirse burayı tekrar aktif edebilirsiniz
    return () => {};
  }, [state]);


  const activeChar = state.characters.find(c => c.id === state.activeCharacterId);
  
  const isAnyCameraSet = state.cameraAngle || state.shotScale || state.lensType;

  const resetApp = async () => {
    if (window.confirm("Tüm stüdyo verileri ve arşiv silinecek. Onaylıyor musun?")) {
      try {
        // Supabase'den tüm verileri sil
        const characters = await supabaseService.getCharacters();
        for (const char of characters) {
          await supabaseService.deleteCharacter(char.id);
        }
        
        // localStorage'ı da temizle (fallback için)
        localStorage.removeItem('kochan_studio_v15');
        window.location.reload();
      } catch (error) {
        // Reset hatası
        // Hata olsa bile localStorage'ı temizle ve yenile
      localStorage.removeItem('kochan_studio_v15');
      window.location.reload();
      }
    }
  };

  const toggleCameraConfig = () => {
    setState(prev => {
      const isOpening = !prev.showCameraConfig;
      if (!isOpening) {
        return {
          ...prev,
          showCameraConfig: false,
          cameraAngle: null,
          shotScale: null,
          lensType: null,
          aspectRatio: '9:16'
        };
      }
      return { ...prev, showCameraConfig: true };
    });
  };

  const handleGenerate = async () => {
    if (!activeChar) { 
      setState(p => ({ ...p, error: "Lütfen bir karakter seçin." })); 
      return; 
    }

    // API key kontrolü
    if (!process.env.API_KEY) {
      setState(p => ({ 
        ...p, 
        error: "API key bulunamadı! Lütfen .env.local dosyasında GEMINI_API_KEY ayarlandığından emin olun." 
      }));
      return;
    }
    
    const currentTab = state.activeTab === 'album' ? 'photo' : state.activeTab as 'photo' | 'video';
    
    // Video için karakter DNA kontrolü (referans görsel opsiyonel)
    if (currentTab === 'video' && !activeChar) {
      setState(p => ({ 
        ...p, 
        error: "Video üretimi için bir karakter seçin." 
      }));
      return;
    }
    
    // Eğer başka bir sekme işleniyorsa, o işlemi durdurma, sadece bu sekmeyi işaretle
    setState(p => ({ 
      ...p, 
      isProcessing: true, 
      processingType: currentTab, 
      error: null 
    }));
    
    // Timeout kontrolü için timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.'));
      }, 120000); // 2 dakika timeout
    });
    
    try {
      let result;
      if (currentTab === 'photo') {
        const cameraSettings = state.showCameraConfig ? {
          angle: state.cameraAngle,
          scale: state.shotScale,
          lens: state.lensType,
          aspectRatio: state.aspectRatio
        } : {
          angle: null, scale: null, lens: null, aspectRatio: '9:16'
        };

        const photoPrompt = state.photoPrompt || '';
        
        // Görsel üretimi başlatılıyor

        // Timeout ile birlikte API çağrısı
        result = await Promise.race([
          editImageWithGemini(activeChar.images, state.styleReferenceImage, photoPrompt, state.activeSeason, cameraSettings),
          timeoutPromise
        ]) as { url: string; name: string };

        // Görsel üretildi

        const newImg: GeneratedImage = { 
          id: Date.now().toString(), 
          url: result.url, 
          name: `${activeChar.name.toUpperCase()}_${result.name}`,
          prompt: state.photoPrompt, 
          timestamp: Date.now(), 
          characterId: activeChar.id 
        };
        
        // Supabase'e kaydet
        try {
          await supabaseService.saveImage(newImg, false);
        } catch (dbError) {
          // Supabase kaydetme hatası
        }
        
        setState(p => ({ 
          ...p, 
          history: [newImg, ...p.history], 
          isProcessing: p.processingType === 'photo' ? false : p.isProcessing,
          processingType: p.processingType === 'photo' ? null : p.processingType,
          photoPrompt: '',
          styleReferenceImage: null,
          error: null 
        }));
      } else {
        const videoPrompt = state.videoPrompt || '';
        
        // Video üretimi başlatılıyor
        
        result = await Promise.race([
          generateVideoWithVeo(activeChar.images, state.videoReferenceImage, videoPrompt, state.activeSeason, state.aspectRatio),
          timeoutPromise
        ]) as { url: string; name: string };

        // Video üretildi

        const newVid: GeneratedVideo = { 
          id: Date.now().toString(), 
          url: result.url, 
          name: `${activeChar.name.toUpperCase()}_${result.name}`,
          prompt: state.videoPrompt, 
          timestamp: Date.now(), 
          characterId: activeChar.id 
        };
        
        // Supabase'e kaydet
        try {
          await supabaseService.saveVideo(newVid, false);
        } catch (dbError) {
          // Supabase kaydetme hatası
        }
        
        setState(p => ({ 
          ...p, 
          videoHistory: [newVid, ...p.videoHistory], 
          isProcessing: p.processingType === 'video' ? false : p.isProcessing,
          processingType: p.processingType === 'video' ? null : p.processingType,
          videoPrompt: '',
          videoReferenceImage: null,
          error: null 
        }));
      }
    } catch (err: any) {
      // Üretim hatası
      
      let errorMessage = 'Bilinmeyen bir hata oluştu.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response) {
        errorMessage = `API Hatası: ${err.response.status} - ${err.response.statusText}`;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      // Timeout hatası için özel mesaj
      if (errorMessage.includes('zaman aşımı') || errorMessage.includes('timeout')) {
        errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin. API yanıt vermedi.';
      }

      // API key hatası için özel mesaj
      if (errorMessage.toLowerCase().includes('api') && errorMessage.toLowerCase().includes('key')) {
        errorMessage = 'API key hatası! Lütfen .env.local dosyasını kontrol edin.';
      }

      // IMAGE_SAFETY hatası için özel mesaj
      if (errorMessage.includes('IMAGE_SAFETY') || errorMessage.includes('SAFETY')) {
        errorMessage = 'İçerik güvenlik kontrolünden geçemedi. Lütfen farklı bir prompt deneyin veya referans görseli değiştirin.';
      }

      setState(p => ({ 
        ...p, 
        isProcessing: p.processingType === currentTab ? false : p.isProcessing,
        processingType: p.processingType === currentTab ? null : p.processingType,
        error: errorMessage 
      }));
    }
  };

  const handleQuickGenerate = async () => {
    if (!state.quickPrompt.trim()) {
      setState(p => ({ ...p, error: "Lütfen bir prompt girin." }));
      return;
    }

    if (!process.env.API_KEY) {
      setState(p => ({ 
        ...p, 
        error: "API key bulunamadı! Lütfen .env.local dosyasında GEMINI_API_KEY ayarlandığından emin olun." 
      }));
      return;
    }

    // Prompt'u sakla (chat'te gösterilecek)
    const promptToUse = state.quickPrompt;
    const referenceImageToUse = state.quickReferenceImage;
    
    // Geçici mesaj ekle (chat'te prompt gösterilecek)
    const tempMessage: GeneratedImage = {
      id: `temp-${Date.now()}`,
      url: '',
      name: '',
      prompt: promptToUse,
      timestamp: Date.now(),
      characterId: 'quick'
    };
    
    // Textarea'yı hemen temizle, geçici mesajı ekle
    setState(p => ({ 
      ...p, 
      isProcessing: true, 
      processingType: 'photo',
      quickPrompt: '', // Textarea'yı temizle
      quickHistory: [tempMessage, ...p.quickHistory], // Geçici mesaj ekle
      error: null 
    }));

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.'));
      }, 120000);
    });

    try {
      const result = await Promise.race([
        generateQuickImage(referenceImageToUse, promptToUse),
        timeoutPromise
      ]) as { url: string; name: string };

      const newImg: GeneratedImage = { 
        id: Date.now().toString(), 
        url: result.url, 
        name: result.name,
        prompt: promptToUse, // Prompt'u görsele kaydet
        timestamp: Date.now(), 
        characterId: 'quick'
      };

      // Geçici mesajı gerçek mesajla değiştir
      setState(p => {
        // Geçici mesajı kaldır, gerçek mesajı ekle
        const filteredHistory = p.quickHistory.filter(h => h.id !== tempMessage.id);
        return {
          ...p, 
          quickHistory: [newImg, ...filteredHistory], // Gerçek mesajı en başa ekle
          quickReferenceImage: null, // Referans görseli temizle
          isProcessing: false,
          processingType: null,
          error: 'Görsel oluşturuldu ✓' 
        };
      });
      setTimeout(() => setState(p => ({...p, error: null})), 2000);
    } catch (err: any) {
      let errorMessage = 'Bilinmeyen bir hata oluştu.';
      if (err.message) {
        errorMessage = err.message;
      }

      if (errorMessage.includes('IMAGE_SAFETY') || errorMessage.includes('SAFETY')) {
        errorMessage = 'İçerik güvenlik kontrolünden geçemedi. Lütfen farklı bir prompt deneyin.';
      }

      setState(p => ({ 
        ...p, 
        isProcessing: false,
        processingType: null,
        error: errorMessage 
      }));
    }
  };

  const archiveItem = async (id: string, type: 'photo' | 'video') => {
    try {
      if (type === 'photo') {
        setState(prev => {
          // Önce normal history'de ara
          let item = prev.history.find(h => h.id === id);
          if (item) {
            // Normal görsel - direkt arşivle
            supabaseService.archiveImage(id).then(() => {
              setState(p => ({ ...p, error: 'Albüme gönderildi ✓' }));
              setTimeout(() => setState(p => ({...p, error: null})), 2000);
            }).catch(() => {
              setState(p => ({ ...p, error: 'Albüme gönderilemedi.' }));
              setTimeout(() => setState(p => ({...p, error: null})), 3000);
            });
        return {
          ...prev,
          history: prev.history.filter(h => h.id !== id),
          archivedImages: [...prev.archivedImages, item]
        };
          }
          // Sonra quick history'de ara
          item = prev.quickHistory.find(h => h.id === id);
          if (item) {
            // Quick görsel - önce veritabanına kaydet (archived olarak)
            const itemToArchive: GeneratedImage = {
              ...item,
              characterId: '00000000-0000-0000-0000-000000000000' // Quick görseller için özel UUID
            };
            
            // Veritabanına kaydet (async işlem)
            (async () => {
              try {
                await supabaseService.saveImage(itemToArchive, true);
                setState(p => ({ ...p, error: 'Albüme gönderildi ✓' }));
                setTimeout(() => setState(p => ({...p, error: null})), 2000);
              } catch (err) {
                // Hata durumunda kullanıcıya bildir
                setState(p => ({ ...p, error: 'Albüme kaydedilemedi. Lütfen tekrar deneyin.' }));
                setTimeout(() => setState(p => ({...p, error: null})), 3000);
              }
            })();
            
            return {
              ...prev,
              quickHistory: prev.quickHistory.filter(h => h.id !== id),
              archivedImages: [...prev.archivedImages, itemToArchive]
            };
          }
          return prev;
        });
      } else {
        await supabaseService.archiveVideo(id);
        setState(prev => {
        const item = prev.videoHistory.find(v => v.id === id);
          if (!item) {
            // Video bulunamadı
            return prev;
          }
          // Video arşivlendi
        return {
          ...prev,
          videoHistory: prev.videoHistory.filter(v => v.id !== id),
          archivedVideos: [...prev.archivedVideos, item]
        };
    });
      }
    } catch (error) {
      // Arşivleme hatası
      setState(prev => ({ ...prev, error: 'Arşivleme başarısız oldu.' }));
    }
  };

  const CameraButtonGrid = ({ title, options, current, onChange }: any) => (
    <div className="space-y-2">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt: string) => (
          <button 
            key={opt} 
            onClick={() => onChange(opt)}
            className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${current === opt ? 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg scale-[1.02]' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/10'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  // Loading ekranı
  if (isLoading) {
    return (
      <div className="h-screen bg-[#020617] text-slate-200 font-sans flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-[5px] border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-lg font-black text-indigo-400 uppercase tracking-[0.4em]">VERİLER YÜKLENİYOR</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 font-sans flex flex-col overflow-hidden">
      
      {/* Modals */}
      {isCreatingChar && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setIsCreatingChar(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!newCharName.trim()) return;
            
            try {
              const newChar = await supabaseService.createCharacter(newCharName.trim(), []);
              if (newChar) {
            setState(p => ({ ...p, characters: [...p.characters, newChar], activeCharacterId: newChar.id }));
            setNewCharName('');
            setIsCreatingChar(false);
              } else {
                setState(p => ({ ...p, error: 'Karakter oluşturulamadı. Supabase bağlantısını kontrol edin.' }));
              }
            } catch (error: any) {
              // Karakter oluşturma hatası
              setState(p => ({ ...p, error: error.message || 'Karakter oluşturulamadı.' }));
            }
          }} onClick={(e) => e.stopPropagation()} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-8 rounded-[3rem] max-w-md w-full space-y-6 shadow-2xl scale-in-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                  <UsersIcon />
                </div>
              </div>
              <h3 className="text-2xl font-black text-center text-white uppercase tracking-tighter mb-2">YENİ KARAKTER DNA</h3>
              <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider mb-6">Karakterinizi oluşturun ve görsellerini ekleyin</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">KARAKTER ADI</label>
            <input 
              autoFocus
              type="text" 
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
                    placeholder="Örn: Maya Winter, John Doe..."
                    className="w-full bg-slate-950/50 border-2 border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all text-white placeholder:text-slate-700"
            />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsCreatingChar(false)} className="flex-1 py-4 rounded-2xl text-xs font-black bg-slate-800/50 border border-white/10 hover:bg-slate-800 transition-all">İPTAL</button>
                  <button type="submit" disabled={!newCharName.trim()} className="flex-1 py-4 rounded-2xl text-xs font-black bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">OLUŞTUR</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-12" onClick={() => setSelectedMedia(null)}>
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {selectedMedia.type === 'photo' ? (
              <img src={selectedMedia.url} className="max-w-full max-h-full rounded-3xl shadow-2xl border border-white/10" />
            ) : (
              <video src={selectedMedia.url} controls autoPlay loop className="max-w-full max-h-full rounded-3xl shadow-2xl border border-white/10" />
            )}
            <button onClick={() => setSelectedMedia(null)} className="absolute -top-10 -right-10 p-4 text-white/50 hover:text-white transition-colors"><CloseIcon /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 bg-[#020617] border-b border-white/5 px-8 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase leading-none">KOCHAN STUDIO</h1>
            <p className="text-[10px] font-black text-indigo-400 tracking-[0.4em] uppercase mt-1">CLOUD PRODUCTION V15</p>
          </div>
        </div>

        <nav className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 gap-2">
          {['photo', 'video', 'quick', 'album'].map(tab => (
            <button 
              key={tab}
              onClick={() => {
                const wasQuick = state.activeTab === 'quick';
                const isQuick = tab === 'quick';
                setState(prev => ({
                  ...prev, 
                  activeTab: tab as any, 
                  error: null,
                  // Quick'ten çıkarken chat geçmişini temizle
                  ...(wasQuick && !isQuick ? { quickHistory: [], quickPrompt: '', quickReferenceImage: null } : {})
                }));
              }} 
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2.5 ${state.activeTab === tab ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tab === 'photo' && <CameraIcon />}
              {tab === 'video' && <VideoIcon />}
              {tab === 'quick' && <MagicIcon />}
              {tab === 'album' && <LayoutGridIcon />}
              {tab === 'quick' ? 'HIZLI' : tab.toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 bg-slate-900/60 px-4 py-2 rounded-xl border border-white/5">
             <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-[0.2em]">CONNECTED</span>
           </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex px-8 py-6 gap-8 overflow-hidden">
        
        {/* Sidebar */}
        <aside className={`w-[340px] flex-shrink-0 overflow-y-auto pr-3 space-y-6 custom-scrollbar ${state.activeTab === 'album' || state.activeTab === 'quick' ? 'hidden' : ''}`}>
          
          <section className="bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 space-y-5 shadow-2xl">
             <div className="flex justify-between items-center px-1">
                <h3 className="text-[12px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-3"><UsersIcon /> KARAKTERLER</h3>
                <button onClick={() => setIsCreatingChar(true)} className="p-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 active:scale-95 shadow-lg shadow-indigo-600/20"><PlusIcon /></button>
             </div>
             
             <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar min-h-[64px]">
                {state.characters.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 flex items-center justify-center mb-3">
                      <UsersIcon />
                    </div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Henüz karakter yok</p>
                    <p className="text-[8px] text-slate-700 mt-1">Yeni karakter oluştur</p>
                  </div>
                ) : (
                  state.characters.map(char => (
                  <button 
                    key={char.id} 
                    onClick={() => setState(p => ({...p, activeCharacterId: char.id}))}
                      className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 transition-all overflow-hidden relative group ${state.activeCharacterId === char.id ? 'border-indigo-500 scale-105 shadow-xl shadow-indigo-500/30' : 'border-white/10 opacity-60 grayscale hover:opacity-100 hover:border-white/20'}`}
                  >
                      {char.images[0] ? (
                        <img src={char.images[0]} className="w-full h-full object-cover" alt={char.name} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-indigo-400 text-xs font-black">{char.name.charAt(0).toUpperCase()}</div>
                          </div>
                        </div>
                      )}
                      {state.activeCharacterId === char.id && (
                        <div className="absolute inset-0 bg-indigo-500/20 border-2 border-indigo-500 rounded-2xl"></div>
                      )}
                  </button>
                  ))
                )}
             </div>

             {activeChar && (
               <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase">{activeChar.name} DNA</span>
                    <button onClick={async () => {
                      if (window.confirm(`${activeChar.name} karakteri ve tüm içeriği silinecek. Onaylıyor musun?`)) {
                        try {
                          await supabaseService.deleteCharacter(activeChar.id);
                          setState(p => ({...p, characters: p.characters.filter(c => c.id !== activeChar.id), activeCharacterId: null}));
                        } catch (error) {
                          // Karakter silme hatası
                          setState(p => ({ ...p, error: 'Karakter silinemedi.' }));
                        }
                      }
                    }} className="text-red-500/30 hover:text-red-500"><DeleteIcon /></button>
                  </div>
                  
                  {/* Loading state */}
                  {isUploadingImages && (
                    <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-center mb-2 animate-in fade-in duration-300">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase text-indigo-400">Görseller işleniyor...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Upload feedback */}
                  {uploadFeedback && (
                    <div className={`p-3 rounded-xl text-[10px] font-black uppercase text-center mb-2 animate-in fade-in duration-300 ${
                      uploadFeedback.type === 'success' 
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                        : 'bg-red-500/20 border border-red-500/30 text-red-400'
                    }`}>
                      {uploadFeedback.message}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-4 gap-2">
                     {activeChar.images.length === 0 ? (
                       <div className="col-span-4 aspect-square rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-dashed border-indigo-500/30 flex flex-col items-center justify-center p-6 text-center group hover:border-indigo-500/50 hover:bg-indigo-500/15 transition-all cursor-pointer" onClick={() => charInputRef.current?.click()}>
                         <div className="w-16 h-16 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                           <CameraIcon />
                         </div>
                         <p className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-1">DNA Görselleri Ekle</p>
                         <p className="text-[8px] text-slate-600">Karakterinizi tanımlamak için görseller yükleyin</p>
                         <p className="text-[8px] text-indigo-500/60 mt-2">Maksimum 8 görsel</p>
                       </div>
                     ) : (
                       <>
                     {activeChar.images.map((img, i) => (
                           <div key={`${activeChar.id}-img-${i}-${img.substring(0, 30)}`} className="aspect-square rounded-xl overflow-hidden relative group border border-white/5 animate-in fade-in duration-300 hover:border-indigo-500/30 transition-all">
                              <img src={img} className="w-full h-full object-cover" alt={`${activeChar.name} DNA ${i + 1}`} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <button onClick={async () => {
                                try {
                                  const updatedImages = activeChar.images.filter((_, idx) => idx !== i);
                                  await supabaseService.updateCharacter(activeChar.id, { images: updatedImages });
                                  setState(p => ({
                            ...p, 
                                    characters: p.characters.map(c => c.id === activeChar.id ? {...c, images: updatedImages} : c)
                                  }));
                                } catch (error) {
                                  // Görsel silme hatası
                                  setState(p => ({ ...p, error: 'Görsel silinemedi.' }));
                                }
                              }} className="absolute inset-0 bg-red-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><DeleteIcon /></button>
                              <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-indigo-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[8px] font-black text-white">{i + 1}</span>
                              </div>
                       </div>
                     ))}
                         {activeChar.images.length < 8 && (
                           <button onClick={() => charInputRef.current?.click()} className="aspect-square bg-slate-950/50 border-2 border-dashed border-indigo-500/30 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all group">
                             <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                               <PlusIcon />
                  </div>
                             <span className="text-[8px] font-black uppercase">Ekle</span>
                           </button>
                         )}
                       </>
                     )}
                  </div>
                  <input type="file" ref={charInputRef} className="hidden" multiple accept="image/*" onChange={async (e) => {
                    const files = Array.from(e.target.files || []) as File[];
                    
                    if (!state.activeCharacterId) {
                      setState(prev => ({ ...prev, error: 'Lütfen önce bir karakter seçin.' }));
                      e.target.value = '';
                      setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
                      return;
                    }
                    
                    if (files.length === 0) {
                      e.target.value = '';
                      return;
                    }
                    
                    // Mevcut karakteri bul
                    const currentChar = state.characters.find(c => c.id === state.activeCharacterId);
                    if (!currentChar) {
                      setState(prev => ({ ...prev, error: 'Karakter bulunamadı.' }));
                      e.target.value = '';
                      setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
                      return;
                    }
                    
                    // Loading state'i başlat
                    setIsUploadingImages(true);
                    setUploadFeedback(null);
                    
                    // Görselleri optimize et ve oku
                    const newImages: string[] = [];
                    
                    for (const file of files) {
                      try {
                        // Görseli optimize et (maksimum 800px genişlik, JPEG kalitesi 0.8)
                        const optimizedBase64 = await new Promise<string>((resolve, reject) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxWidth = 800;
                            const maxHeight = 800;
                            let width = img.width;
                            let height = img.height;
                            
                            // Boyutlandır
                            if (width > maxWidth || height > maxHeight) {
                              const ratio = Math.min(maxWidth / width, maxHeight / height);
                              width = width * ratio;
                              height = height * ratio;
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                              reject(new Error('Canvas context alınamadı'));
                              return;
                            }
                            
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // JPEG olarak kaydet (daha küçük boyut)
                            const quality = 0.8;
                            const base64 = canvas.toDataURL('image/jpeg', quality);
                            resolve(base64);
                          };
                          img.onerror = () => {
                            URL.revokeObjectURL(blobUrl);
                            reject(new Error('Görsel yüklenemedi'));
                          };
                          const blobUrl = URL.createObjectURL(file);
                          img.src = blobUrl;
                        });
                        
                        newImages.push(optimizedBase64);
                      } catch (error) {
                        // Hata durumunda orijinal dosyayı kullan
                      const reader = new FileReader();
                        await new Promise<void>((resolve) => {
                      reader.onloadend = () => {
                            if (reader.result) {
                              newImages.push(reader.result as string);
                            }
                            resolve();
                          };
                          reader.onerror = () => resolve();
                      reader.readAsDataURL(file);
                    });
                      }
                    }
                    
                    if (newImages.length === 0) {
                      setState(prev => ({ ...prev, error: 'Görseller yüklenemedi.' }));
                      e.target.value = '';
                      setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
                      return;
                    }
                      
                    // Güncellenmiş görselleri hazırla (maksimum 8)
                    const updatedImages = [...currentChar.images, ...newImages].slice(-8);
                    
                    // Önce Supabase'e kaydet, sonra state'i güncelle
                    try {
                      await supabaseService.updateCharacter(state.activeCharacterId, { images: updatedImages });
                      
                      // Başarılı olursa state'i güncelle
                      setState(prev => {
                        const updatedChars = prev.characters.map(c => 
                          c.id === state.activeCharacterId ? { ...c, images: updatedImages } : c
                        );
                        return { ...prev, characters: updatedChars, error: null };
                      });
                      
                      setUploadFeedback({ message: `${newImages.length} görsel eklendi!`, type: 'success' });
                      setTimeout(() => setUploadFeedback(null), 3000);
                    } catch (error: any) {
                      const errorMsg = error.message || 'Görseller kaydedilemedi.';
                      setState(prev => ({ ...prev, error: errorMsg }));
                      setUploadFeedback({ message: errorMsg, type: 'error' });
                      setTimeout(() => {
                        setUploadFeedback(null);
                        setState(prev => ({ ...prev, error: null }));
                      }, 3000);
                    } finally {
                      setIsUploadingImages(false);
                    }
                    
                    // Input'u temizle
                    e.target.value = '';
                  }} />
               </div>
             )}
          </section>

          {state.activeTab === 'photo' && (
            <>
              <section className="bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
                 <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3"><SunIcon /> ATMOSFER</h3>
                 <div className="grid grid-cols-2 gap-3">
                    {['summer', 'autumn', 'winter', 'spring'].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setState(p => ({...p, activeSeason: p.activeSeason === s ? 'default' : s as any}))} 
                        className={`p-3 rounded-2xl border text-[11px] font-black transition-all ${state.activeSeason === s ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-950/50 border-white/5 text-slate-500'}`}
                      >
                         {s === 'summer' ? 'YAZ' : s === 'autumn' ? 'SONBAHAR' : s === 'winter' ? 'KIŞ' : 'İLKBAHAR'}
                      </button>
                    ))}
                 </div>
              </section>

              <section className={`rounded-[2.5rem] border overflow-hidden transition-all duration-300 ${state.showCameraConfig ? 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)] bg-green-500/5' : 'border-white/5 bg-slate-900/40'}`}>
                <button 
                  onClick={toggleCameraConfig} 
                  className={`w-full p-6 flex items-center justify-between group transition-all ${state.showCameraConfig ? 'text-green-500' : 'text-slate-400'}`}
                >
                  <h3 className="text-[12px] font-black uppercase tracking-widest flex items-center gap-3">
                    <CameraIcon /> KAMERA AYARLARI 
                    {state.showCameraConfig ? (
                       <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e] animate-pulse"></div>
                    ) : (
                       isAnyCameraSet && <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></div>
                    )}
                  </h3>
                  <div className={`transition-transform duration-300 ${state.showCameraConfig ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                  </div>
                </button>
                {state.showCameraConfig && (
                  <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4 bg-black/20 animate-in slide-in-from-top-4 duration-300">
                    <CameraButtonGrid title="ASPECT RATIO" options={CAMERA_OPTIONS.aspectRatios} current={state.aspectRatio} onChange={(v:any) => setState(p => ({...p, aspectRatio: v}))} />
                    <CameraButtonGrid title="KAMERA AÇISI" options={CAMERA_OPTIONS.angles} current={state.cameraAngle} onChange={(v:any) => setState(p => ({...p, cameraAngle: v}))} />
                    <CameraButtonGrid title="ÇEKİM ÖLÇEĞİ" options={CAMERA_OPTIONS.scales} current={state.shotScale} onChange={(v:any) => setState(p => ({...p, shotScale: v}))} />
                    <CameraButtonGrid title="LENS TERCİHİ" options={CAMERA_OPTIONS.lenses} current={state.lensType} onChange={(v:any) => setState(p => ({...p, lensType: v}))} />
                    {isAnyCameraSet && (
                      <button onClick={() => setState(p => ({...p, cameraAngle: null, shotScale: null, lensType: null, aspectRatio: '9:16'}))} className="w-full py-2.5 text-[10px] font-black text-red-400 hover:text-red-500 uppercase tracking-widest border border-red-500/20 rounded-xl transition-all">
                        AYARLARI TEMİZLE
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {state.activeTab === 'quick' && (
            <>
              <section className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 space-y-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-xl"><MagicIcon /></div>
                  <div>
                    <h3 className="text-[12px] font-black text-indigo-400 uppercase tracking-widest">HIZLI OLUŞTUR</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Karakter olmadan hızlı görsel üret</p>
                  </div>
                </div>
              </section>

              <section className="bg-slate-900/40 p-5 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <UploadIcon /> REFERANS GÖRSEL
                  </h3>
                  <span className="text-[8px] font-black text-slate-600 uppercase">OPSİYONEL</span>
                </div>
                {!state.quickReferenceImage ? (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (quickInputRef.current) {
                        quickInputRef.current.click();
                      }
                    }} 
                    className="w-full h-20 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-700 hover:border-indigo-500/30 hover:bg-indigo-600/5 transition-all group"
                  >
                    <div className="group-hover:scale-110 transition-transform"><UploadIcon /></div>
                    <span className="text-[9px] font-black mt-1 uppercase tracking-widest">GÖRSEL YÜKLE</span>
                  </button>
                ) : (
                  <div className="relative h-24 rounded-2xl overflow-hidden border border-indigo-500/30 group shadow-lg">
                    <img src={state.quickReferenceImage} className="w-full h-full object-cover" />
                    <button onClick={() => {
                      setState(p => ({...p, quickReferenceImage: null}));
                    }} className="absolute inset-0 bg-red-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black text-[10px] uppercase transition-all">SİL</button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={quickInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      e.target.value = '';
                      return;
                    }

                    if (!file.type.startsWith('image/')) {
                      // Sadece görsel dosyaları yüklenebilir
                      setState(p => ({ ...p, error: 'Sadece görsel dosyaları yüklenebilir' }));
                      e.target.value = '';
                      return;
                    }

                    const reader = new FileReader();
                    
                    reader.onloadend = () => {
                      try {
                        const dataUrl = reader.result as string;
                        if (!dataUrl) {
                          // Görsel okunamadı
                          return;
                        }

                        setState(p => ({ ...p, quickReferenceImage: dataUrl, error: null }));
                        // Hızlı oluşturma referans görseli yüklendi
                      } catch (err) {
                        // Görsel yükleme hatası
                        setState(p => ({ ...p, error: 'Görsel yüklenirken bir hata oluştu' }));
                      }
                      e.target.value = '';
                    };

                    reader.onerror = () => {
                      // FileReader hatası
                      setState(p => ({ ...p, error: 'Görsel okunamadı' }));
                      e.target.value = '';
                    };

                    reader.readAsDataURL(file);
                  }} 
                />
              </section>
            </>
          )}

          {/* Re-designed Bottom Section */}
          <div className="space-y-6 pt-2">
            {/* Reference Image Section */}
            {state.activeTab !== 'quick' && (
            <section className="bg-slate-900/40 p-5 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
               <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                     {state.activeTab === 'photo' ? <MagicIcon /> : <VideoIcon />} STYLE REFERENCE
                  </h3>
                  <span className="text-[8px] font-black text-slate-600 uppercase">OPSİYONEL</span>
               </div>
               {!(state.activeTab === 'photo' ? state.styleReferenceImage : state.videoReferenceImage) ? (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Reference yükleme butonu tıklandı
                      if (styleInputRef.current) {
                        styleInputRef.current.click();
                      } else {
                        // styleInputRef bulunamadı
                      }
                    }} 
                    className="w-full h-20 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-700 hover:border-indigo-500/30 hover:bg-indigo-600/5 transition-all group"
                  >
                    <div className="group-hover:scale-110 transition-transform"><UploadIcon /></div>
                    <span className="text-[9px] font-black mt-1 uppercase tracking-widest">POZ YÜKLE</span>
                  </button>
                ) : (
                  <div className="relative h-24 rounded-2xl overflow-hidden border border-indigo-500/30 group shadow-lg">
                    <img src={(state.activeTab === 'photo' ? state.styleReferenceImage : state.videoReferenceImage) as string} className="w-full h-full object-cover" />
                    <button onClick={() => {
                      if (state.activeTab === 'photo') {
                        setState(p => ({...p, styleReferenceImage: null}));
                      } else {
                        setState(p => ({...p, videoReferenceImage: null}));
                      }
                    }} className="absolute inset-0 bg-red-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black text-[10px] uppercase transition-all">REFERANSI SİL</button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={styleInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                  const file = e.target.files?.[0];
                    if (!file) {
                      e.target.value = '';
                      return;
                    }

                    // Dosya tipi kontrolü
                    if (!file.type.startsWith('image/')) {
                      // Sadece görsel dosyaları yüklenebilir
                      setState(p => ({ ...p, error: 'Sadece görsel dosyaları yüklenebilir' }));
                      e.target.value = '';
                      return;
                    }

                    const reader = new FileReader();
                    
                    reader.onloadend = () => {
                      try {
                      const dataUrl = reader.result as string;
                        if (!dataUrl) {
                          // Görsel okunamadı
                          return;
                        }

                        // Active tab'a göre güncelleme
                        const currentTab = state.activeTab;
                        if (currentTab === 'photo') {
                          setState(p => ({ ...p, styleReferenceImage: dataUrl, error: null }));
                          // Style reference görsel yüklendi
                        } else if (currentTab === 'video') {
                          setState(p => ({ ...p, videoReferenceImage: dataUrl, error: null }));
                          // Video reference görsel yüklendi
                        }
                      } catch (err) {
                        // Görsel yükleme hatası
                        setState(p => ({ ...p, error: 'Görsel yüklenirken bir hata oluştu' }));
                  }
                  e.target.value = '';
                    };

                    reader.onerror = () => {
                      // FileReader hatası
                      setState(p => ({ ...p, error: 'Görsel okunamadı' }));
                      e.target.value = '';
                    };

                    reader.readAsDataURL(file);
                  }} 
                />
            </section>
            )}

            {/* Scene Prompt Section */}
            <section className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-30 group-focus-within:opacity-100 transition-opacity"></div>
               <div className="flex items-center gap-3 px-1">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><MagicIcon /></div>
                  <h3 className="text-[12px] font-black text-white uppercase tracking-widest">SAHNE DETAYLARI</h3>
               </div>
               
               <textarea 
                  value={state.activeTab === 'quick' ? state.quickPrompt : (state.activeTab === 'photo' ? state.photoPrompt : state.videoPrompt)} 
                  onChange={(e) => {
                    if (state.activeTab === 'quick') {
                      setState(p => ({...p, quickPrompt: e.target.value}));
                    } else if (state.activeTab === 'photo') {
                      setState(p => ({...p, photoPrompt: e.target.value}));
                    } else {
                      setState(p => ({...p, videoPrompt: e.target.value}));
                    }
                  }} 
                  placeholder={state.activeTab === 'quick'
                    ? "Görseli tanımlayın (örn: modern ofis ortamı, güneşli plaj, şehir manzarası...)"
                    : state.activeTab === 'photo' 
                    ? "Karakteri nereye koyalım? (örn: gece kulübü girişi, neon ışıklar, elinde içecek...)" 
                    : "Video için aksiyon tanımlayın (örn: dans ediyor, gülümsüyor, yürüyor...)"} 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-sm h-32 outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all resize-none text-slate-200 placeholder:text-slate-700 shadow-inner custom-scrollbar" 
               />

               <button 
                 onClick={state.activeTab === 'quick' ? handleQuickGenerate : handleGenerate} 
                 disabled={state.isProcessing && (state.activeTab === 'quick' ? state.processingType === 'photo' : state.processingType === state.activeTab)} 
                 className={`w-full py-5 rounded-[1.75rem] font-black text-[11px] tracking-[0.4em] uppercase transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3 ${state.isProcessing && (state.activeTab === 'quick' ? state.processingType === 'photo' : state.processingType === state.activeTab) ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/40 hover:scale-[1.02]'}`}
               >
                  {state.isProcessing && (state.activeTab === 'quick' ? state.processingType === 'photo' : state.processingType === state.activeTab) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>İŞLENİYOR</span>
                    </>
                  ) : (
                    "ÜRETİMİ BAŞLAT"
                  )}
               </button>
               {state.error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[9px] text-red-400 font-bold uppercase text-center animate-shake">{state.error}</div>}
            </section>
          </div>
        </aside>

        {/* Main Display Area */}
        <section className="flex-grow flex flex-col min-0">
           <div className="flex-grow overflow-y-auto pr-4 pb-12 custom-scrollbar">
             {state.activeTab === 'album' ? (
               <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="flex justify-between items-end border-b border-white/5 pb-6">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">STUDIO ARCHIVES</h2>
                    <div className="flex items-center gap-4">
                      {state.selectedFolderId && state.selectedFolderId !== 'quick' && (() => {
                        const char = state.characters.find(c => c.id === state.selectedFolderId);
                        if (!char) return null;
                        const charImgs = state.archivedImages.filter(h => h.characterId === char.id);
                        const charVids = state.archivedVideos.filter(vh => vh.characterId === char.id);
                        const dnaCount = char.images.length;
                        const generatedCount = charImgs.length + charVids.length;
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[12px] font-black text-indigo-400 uppercase tracking-widest">{generatedCount} OLUŞTURULAN GÖRSELLER</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{dnaCount} DNA GÖRSELLERİ</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">TOPLAM: {generatedCount + dnaCount}</span>
                          </div>
                        );
                      })()}
                      {state.selectedFolderId === 'quick' && (() => {
                        const quickImgs = state.archivedImages.filter(h => h.characterId === '00000000-0000-0000-0000-000000000000');
                        const quickVids = state.archivedVideos.filter(vh => vh.characterId === '00000000-0000-0000-0000-000000000000');
                        return (
                          <span className="text-[12px] font-black text-indigo-400 uppercase tracking-widest">{quickImgs.length + quickVids.length} OLUŞTURULAN GÖRSELLER</span>
                        );
                      })()}
                      {!state.selectedFolderId && (
                    <span className="text-[12px] font-black text-indigo-400 uppercase tracking-widest">{state.archivedImages.length + state.archivedVideos.length} DOSYA</span>
                      )}
                    </div>
                  </div>
                  
                  {state.characters.length === 0 && state.archivedImages.filter(img => img.characterId === '00000000-0000-0000-0000-000000000000').length === 0 && !state.selectedFolderId && <div className="text-center py-20 text-slate-700 font-black text-xl uppercase tracking-widest">ARŞİV BOŞ</div>}
                  
                  {/* Geri ve Seçim Butonları - Seçili klasör varsa göster */}
                  {state.selectedFolderId && (
                    <div className="mb-6 flex items-center justify-between">
                      <button
                        onClick={() => setState(p => ({...p, selectedFolderId: null, selectedItems: [], isSelectionMode: false}))}
                        className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 hover:bg-slate-900/60 rounded-2xl border border-white/10 transition-all group"
                      >
                        <span className="text-white/60 group-hover:text-white transform transition-transform group-hover:-translate-x-1">←</span>
                        <span className="text-sm font-black text-white uppercase tracking-tight">GERİ</span>
                      </button>
                      
                      <div className="flex items-center gap-3">
                        {state.isSelectionMode && state.selectedItems.length > 0 && (
                          <>
                            <div className="text-sm font-black text-indigo-400 uppercase">
                              {state.selectedItems.length} SEÇİLDİ
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  for (const id of state.selectedItems) {
                                    const img = state.archivedImages.find(i => i.id === id);
                                    const vid = state.archivedVideos.find(v => v.id === id);
                                    if (img) await supabaseService.deleteImage(id);
                                    if (vid) await supabaseService.deleteVideo(id);
                                  }
                                  setState(p => ({
                                    ...p,
                                    archivedImages: p.archivedImages.filter(i => !p.selectedItems.includes(i.id)),
                                    archivedVideos: p.archivedVideos.filter(v => !p.selectedItems.includes(v.id)),
                                    selectedItems: [],
                                    error: 'Seçilen dosyalar silindi ✓'
                                  }));
                                  setTimeout(() => setState(p => ({...p, error: null})), 2000);
                                } catch (error) {
                                  setState(p => ({...p, error: 'Silme işlemi başarısız oldu.'}));
                                }
                              }}
                              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase bg-red-600 text-white hover:bg-red-500 transition-all"
                            >
                              SİL
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setState(p => ({...p, isSelectionMode: !p.isSelectionMode, selectedItems: []}))}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                            state.isSelectionMode 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
                          }`}
                        >
                          {state.isSelectionMode ? 'SEÇİMİ İPTAL' : 'SEÇ'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Folders Grid - Klasörler yan yana görsel kartlar - Sadece seçili klasör yoksa göster */}
                  {!state.selectedFolderId && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-10">
                    {/* Quick görseller klasörü */}
                    {(() => {
                      const quickImgs = state.archivedImages.filter(h => h.characterId === '00000000-0000-0000-0000-000000000000');
                      const quickVids = state.archivedVideos.filter(vh => vh.characterId === '00000000-0000-0000-0000-000000000000');
                      if (quickImgs.length === 0 && quickVids.length === 0) return null;
                      
                      const isQuickSelected = state.selectedFolderId === 'quick';
                      const recentItems = [...quickImgs, ...quickVids].sort((a,b) => b.timestamp - a.timestamp).slice(0, 4);
                      
                      return (
                        <button
                          key="quick"
                          onClick={() => {
                            setState(p => ({
                              ...p,
                              selectedFolderId: isQuickSelected ? null : 'quick'
                            }));
                          }}
                          className={`relative aspect-[4/5] bg-slate-900/40 rounded-3xl border-2 overflow-hidden group transition-all hover:scale-105 shadow-2xl ${
                            isQuickSelected 
                              ? 'border-indigo-500 ring-2 ring-indigo-500/50' 
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          {/* Arka plan - Oluşturulan görsellerden preview */}
                          <div className="absolute inset-0 grid grid-cols-2 gap-1 p-2 opacity-30 group-hover:opacity-40 transition-opacity">
                            {recentItems.slice(0, 4).map((item, idx) => (
                              <div key={idx} className="relative rounded-xl overflow-hidden">
                                {item.url.startsWith('blob:') || item.url.includes('.mp4') ? (
                                  <video src={item.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <img src={item.url} className="w-full h-full object-cover" />
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
                          
                          {/* İçerik */}
                          <div className="relative h-full flex flex-col justify-end p-6 z-10">
                            <div className="mb-4 flex items-center justify-center">
                              <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-purple-500/60 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                                <MagicIcon />
                              </div>
                            </div>
                            <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-1">HIZLI OLUŞTURULAN</h4>
                            <span className="text-sm text-slate-300">{quickImgs.length + quickVids.length} dosya</span>
                          </div>
                        </button>
                      );
                    })()}
                    
                    {/* Karakter klasörleri */}
                  {state.characters.map(char => {
                    const charImgs = state.archivedImages.filter(h => h.characterId === char.id);
                    const charVids = state.archivedVideos.filter(vh => vh.characterId === char.id);
                    if (charImgs.length === 0 && charVids.length === 0) return null;
                      
                      const isCharSelected = state.selectedFolderId === char.id;
                      const recentItems = [...charImgs, ...charVids].sort((a,b) => b.timestamp - a.timestamp).slice(0, 4);
                      const profileImage = char.images[0] || '';
                    
                    return (
                        <button
                          key={char.id}
                          onClick={() => {
                            setState(p => ({
                              ...p,
                              selectedFolderId: isCharSelected ? null : char.id
                            }));
                          }}
                          className={`relative aspect-[4/5] bg-slate-900/40 rounded-3xl border-2 overflow-hidden group transition-all hover:scale-105 shadow-2xl ${
                            isCharSelected 
                              ? 'border-indigo-500 ring-2 ring-indigo-500/50' 
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          {/* Arka plan - Oluşturulan görsellerden preview */}
                          {recentItems.length > 0 && (
                            <div className="absolute inset-0 grid grid-cols-2 gap-1 p-2 opacity-30 group-hover:opacity-40 transition-opacity">
                              {recentItems.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="relative rounded-xl overflow-hidden">
                                  {item.url.startsWith('blob:') || item.url.includes('.mp4') ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <img src={item.url} className="w-full h-full object-cover" />
                                  )}
                            </div>
                              ))}
                         </div>
                          )}
                          
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
                          
                          {/* İçerik */}
                          <div className="relative h-full flex flex-col justify-end p-6 z-10">
                            {/* Profil Resmi - Büyük Yuvarlak */}
                            <div className="mb-4 flex items-center justify-center">
                              <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-indigo-500/60 shadow-xl ring-4 ring-slate-900/50">
                                <img src={profileImage} className="w-full h-full object-cover" />
                              </div>
                            </div>
                            <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-1">{char.name} DNA</h4>
                            <span className="text-sm text-slate-300">{charImgs.length + charVids.length} dosya</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  )}
                  
                  {/* Seçili Klasörün İçeriği - Sadece açık klasör gösterilir */}
                  {state.selectedFolderId === 'quick' && (() => {
                    const quickImgs = state.archivedImages.filter(h => h.characterId === '00000000-0000-0000-0000-000000000000');
                    const quickVids = state.archivedVideos.filter(vh => vh.characterId === '00000000-0000-0000-0000-000000000000');
                    const allItems = [...quickImgs, ...quickVids].sort((a,b) => b.timestamp - a.timestamp);
                    
                    // Tarih bazlı gruplandırma
                    const groupedByDate = allItems.reduce((acc: any, item: any) => {
                      const date = new Date(item.timestamp);
                      const dateKey = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
                      if (!acc[dateKey]) {
                        acc[dateKey] = [];
                      }
                      acc[dateKey].push(item);
                      return acc;
                    }, {});
                    
                    return (
                      <div className="space-y-8 animate-in fade-in duration-300">
                        {Object.entries(groupedByDate).map(([dateKey, items]: [string, any[]]) => (
                          <div key={dateKey} className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">{dateKey}</h3>
                              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 px-1">
                              {items.map((item: any) => {
                              const isSelected = state.selectedItems.includes(item.id);
                              return (
                               <div 
                                 key={item.id} 
                                 onClick={(e) => {
                                   if (state.isSelectionMode) {
                                     e.stopPropagation();
                                     setState(p => ({
                                       ...p,
                                       selectedItems: isSelected
                                         ? p.selectedItems.filter(id => id !== item.id)
                                         : [...p.selectedItems, item.id]
                                     }));
                                   }
                                 }}
                                 className={`aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden border-2 transition-all shadow-2xl relative cursor-pointer ${isSelected ? 'border-indigo-500 scale-105 ring-2 ring-indigo-500/50' : 'border-white/5 group hover:scale-[1.05]'}`}
                               >
                                 {/* Selection Checkbox */}
                                 {state.isSelectionMode && (
                                   <div className={`absolute top-4 left-4 z-20 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-400' : 'bg-black/50 border-white/30'}`}>
                                     {isSelected && <span className="text-white text-xs">✓</span>}
                                   </div>
                                 )}
                                 {item.url.startsWith('blob:') || item.url.includes('.mp4') ? <video src={item.url} autoPlay loop muted className="w-full h-full object-cover" /> : <img src={item.url} className="w-full h-full object-cover" />}
                                 <div className={`absolute inset-0 bg-black/90 transition-all flex flex-col justify-end p-6 gap-3 backdrop-blur-sm ${state.isSelectionMode ? 'opacity-50' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <div className="text-[10px] font-black text-white truncate mb-1 uppercase tracking-tighter border-b border-white/10 pb-1">{item.name}</div>
                                    <div className="text-[9px] text-slate-400 mb-2">{new Date(item.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                       <button onClick={() => setSelectedMedia({url: item.url, type: (item.url.startsWith('blob:') ? 'video' : 'photo')})} className="py-3.5 bg-white text-black rounded-2xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all">GÖR</button>
                                       <a href={item.url} download={`${item.name}.${item.url.includes('blob') ? 'mp4' : 'png'}`} onClick={e => e.stopPropagation()} className="py-3.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all">
                                         <DownloadIcon /> AL
                                       </a>
                                    </div>
                                    {/* Referans ve çıkart butonları */}
                                    {(() => {
                                      const isVideo = item.url.startsWith('blob:') || item.url.includes('.mp4');
                                      
                                      if (isVideo) {
                                        // Video için sadece albümden çıkart
                                        return (
                                          <button onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              await supabaseService.unarchiveVideo(item.id);
                                              
                                              setState(prev => {
                                                const videoItem = prev.archivedVideos.find(v => v.id === item.id);
                                                if (!videoItem) return prev;
                                                
                                                return {
                                                  ...prev,
                                                  activeTab: 'video',
                                                  archivedVideos: prev.archivedVideos.filter(v => v.id !== item.id),
                                                  videoHistory: [videoItem, ...prev.videoHistory]
                                                };
                                              });
                                            } catch (error) {
                                              setState(prev => ({ ...prev, error: 'Albümden çıkarılamadı.' }));
                                            }
                                          }} className="w-full py-3.5 bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-500 transition-all">
                                            <LayoutGridIcon /> ALBÜMDEN ÇIKART
                                          </button>
                                        );
                                      } else {
                                        // Görsel için referans ve çıkart butonları
                                        return (
                                          <>
                                            {/* Fotoğraf referansı */}
                                            <button onClick={(e) => {
                                              e.stopPropagation();
                                              setState(prev => ({
                                                ...prev,
                                                activeTab: 'photo',
                                                styleReferenceImage: item.url
                                              }));
                                            }} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all">
                                              <CameraIcon /> FOTOĞRAF REFERANSI
                                            </button>
                                            {/* Video referansı */}
                                            <button onClick={(e) => {
                                              e.stopPropagation();
                                              setState(prev => ({
                                                ...prev,
                                                activeTab: 'video',
                                                videoReferenceImage: item.url
                                              }));
                                            }} className="w-full py-3.5 bg-purple-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-purple-500 transition-all">
                                              <VideoIcon /> VİDEO REFERANSI
                                            </button>
                                            {/* Albümden çıkart */}
                                            <button onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await supabaseService.unarchiveImage(item.id);
                                                
                                                setState(prev => {
                                                  const imageItem = prev.archivedImages.find(img => img.id === item.id);
                                                  if (!imageItem) return prev;
                                                  
                                                  return {
                                                    ...prev,
                                                    activeTab: 'photo',
                                                    archivedImages: prev.archivedImages.filter(img => img.id !== item.id),
                                                    history: [imageItem, ...prev.history]
                                                  };
                                                });
                                              } catch (error) {
                                                setState(prev => ({ ...prev, error: 'Albümden çıkarılamadı.' }));
                                              }
                                            }} className="w-full py-3.5 bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-500 transition-all">
                                              <LayoutGridIcon /> ALBÜMDEN ÇIKART
                                            </button>
                                          </>
                                        );
                                      }
                                    })()}
                                    <button onClick={async () => {
                                      try {
                                        if (item.url.startsWith('blob:') || item.url.includes('.mp4')) {
                                          await supabaseService.deleteVideo(item.id);
                                          setState(p => ({...p, archivedVideos: p.archivedVideos.filter(v => v.id !== item.id)}));
                                        } else {
                                          await supabaseService.deleteImage(item.id);
                                          setState(p => ({...p, archivedImages: p.archivedImages.filter(img => img.id !== item.id)}));
                                        }
                                      } catch (error) {
                                        setState(p => ({ ...p, error: 'Silme işlemi başarısız oldu.' }));
                                      }
                                    }} className="text-slate-600 hover:text-red-500 transition-all font-black text-[9px] uppercase mt-2">SİL</button>
                                 </div>
                               </div>
                              );
                            })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  
                  {/* Karakter klasörü içeriği */}
                  {state.selectedFolderId && state.selectedFolderId !== 'quick' && (() => {
                    const char = state.characters.find(c => c.id === state.selectedFolderId);
                    if (!char) return null;
                    
                    const charImgs = state.archivedImages.filter(h => h.characterId === char.id);
                    const charVids = state.archivedVideos.filter(vh => vh.characterId === char.id);
                    const allItems = [...charImgs, ...charVids].sort((a,b) => b.timestamp - a.timestamp);
                    
                    // Tarih bazlı gruplandırma
                    const groupedByDate = allItems.reduce((acc: any, item: any) => {
                      const date = new Date(item.timestamp);
                      const dateKey = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
                      if (!acc[dateKey]) {
                        acc[dateKey] = [];
                      }
                      acc[dateKey].push(item);
                      return acc;
                    }, {});
                    
                    return (
                      <div className="space-y-8 animate-in fade-in duration-300">
                         {/* Loading state */}
                         {isUploadingImages && (
                           <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-center mb-2 animate-in fade-in duration-300">
                             <div className="flex items-center justify-center gap-3">
                               <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                               <span className="text-[10px] font-black uppercase text-indigo-400">Görseller işleniyor...</span>
                             </div>
                           </div>
                         )}
                         
                         {/* Upload feedback */}
                         {uploadFeedback && (
                           <div className={`p-3 rounded-xl text-[10px] font-black uppercase text-center mb-2 animate-in fade-in duration-300 ${
                             uploadFeedback.type === 'success' 
                               ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                               : 'bg-red-500/20 border border-red-500/30 text-red-400'
                           }`}>
                             {uploadFeedback.message}
                           </div>
                         )}
                         
                         {/* DNA Görselleri Özeti */}
                         <div className="space-y-2">
                           <div className="flex items-center justify-between px-2 mb-2">
                             <div className="text-xs font-black text-slate-400 uppercase tracking-wider">DNA Görselleri</div>
                             <input 
                               type="file" 
                               ref={albumCharInputRef} 
                               className="hidden" 
                               multiple 
                               accept="image/*" 
                               onChange={async (e) => {
                                 const files = Array.from(e.target.files || []) as File[];
                                 if (!char.id || files.length === 0) {
                                   e.target.value = '';
                                   return;
                                 }
                                 
                                 // Loading state'i başlat
                                 setIsUploadingImages(true);
                                 setUploadFeedback(null);
                                 
                                 // Görselleri optimize et ve oku
                                 const newImages: string[] = [];
                                 
                                 for (const file of files) {
                                   try {
                                     // Görseli optimize et (maksimum 800px genişlik, JPEG kalitesi 0.8)
                                     const optimizedBase64 = await new Promise<string>((resolve, reject) => {
                                       const img = new Image();
                                       const blobUrl = URL.createObjectURL(file);
                                       img.onload = () => {
                                         const canvas = document.createElement('canvas');
                                         const maxWidth = 800;
                                         const maxHeight = 800;
                                         let width = img.width;
                                         let height = img.height;
                                         
                                         // Boyutlandır
                                         if (width > maxWidth || height > maxHeight) {
                                           const ratio = Math.min(maxWidth / width, maxHeight / height);
                                           width = width * ratio;
                                           height = height * ratio;
                                         }
                                         
                                         canvas.width = width;
                                         canvas.height = height;
                                         const ctx = canvas.getContext('2d');
                                         if (!ctx) {
                                           URL.revokeObjectURL(blobUrl);
                                           reject(new Error('Canvas context alınamadı'));
                                           return;
                                         }
                                         
                                         ctx.drawImage(img, 0, 0, width, height);
                                         
                                         // JPEG olarak kaydet (daha küçük boyut)
                                         const quality = 0.8;
                                         const base64 = canvas.toDataURL('image/jpeg', quality);
                                         URL.revokeObjectURL(blobUrl);
                                         resolve(base64);
                                       };
                                       img.onerror = () => {
                                         URL.revokeObjectURL(blobUrl);
                                         reject(new Error('Görsel yüklenemedi'));
                                       };
                                       img.src = blobUrl;
                                     });
                                     
                                     newImages.push(optimizedBase64);
                                   } catch (error) {
                                     // Hata durumunda orijinal dosyayı kullan
                                     const reader = new FileReader();
                                     await new Promise<void>((resolve) => {
                                       reader.onloadend = () => {
                                         if (reader.result) {
                                           newImages.push(reader.result as string);
                                         }
                                         resolve();
                                       };
                                       reader.onerror = () => resolve();
                                       reader.readAsDataURL(file);
                                     });
                                   }
                                 }
                                 
                                 if (newImages.length === 0) {
                                   setState(prev => ({ ...prev, error: 'Görseller yüklenemedi.' }));
                                   setIsUploadingImages(false);
                                   e.target.value = '';
                                   return;
                                 }
                                 
                                 const updatedImages = [...char.images, ...newImages].slice(-8);
                                 
                                 try {
                                   await supabaseService.updateCharacter(char.id, { images: updatedImages });
                                   setState(prev => {
                                     const updatedChars = prev.characters.map(c => 
                                       c.id === char.id ? { ...c, images: updatedImages } : c
                                     );
                                     return { ...prev, characters: updatedChars, error: null };
                                   });
                                   setUploadFeedback({ message: `${newImages.length} görsel eklendi!`, type: 'success' });
                                   setTimeout(() => setUploadFeedback(null), 3000);
                                 } catch (error: any) {
                                   setState(prev => ({ ...prev, error: error.message || 'Görseller kaydedilemedi.' }));
                                   setUploadFeedback({ message: 'Görseller kaydedilemedi.', type: 'error' });
                                   setTimeout(() => {
                                     setUploadFeedback(null);
                                     setState(prev => ({ ...prev, error: null }));
                                   }, 3000);
                                 } finally {
                                   setIsUploadingImages(false);
                                 }
                                 
                                 e.target.value = '';
                               }}
                             />
                             <button
                               onClick={() => albumCharInputRef.current?.click()}
                               className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5"
                             >
                               <PlusIcon /> EKLE
                             </button>
                           </div>
                           <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 px-1">
                             {char.images.map((img, idx) => (
                               <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-white/10 group relative">
                                 <img src={img} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <button
                                     onClick={async () => {
                                       try {
                                         const updatedImages = char.images.filter((_, i) => i !== idx);
                                         await supabaseService.updateCharacter(char.id, { images: updatedImages });
                                         setState(prev => {
                                           const updatedChars = prev.characters.map(c => 
                                             c.id === char.id ? { ...c, images: updatedImages } : c
                                           );
                                           return { ...prev, characters: updatedChars, error: null };
                                         });
                                         setUploadFeedback({ message: 'Görsel silindi!', type: 'success' });
                                         setTimeout(() => setUploadFeedback(null), 3000);
                                       } catch (error: any) {
                                         setState(prev => ({ ...prev, error: error.message || 'Görsel silinemedi.' }));
                                         setTimeout(() => setState(prev => ({ ...prev, error: null })), 3000);
                                       }
                                     }}
                                     className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-all"
                                   >
                                     <DeleteIcon />
                                   </button>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                         {/* Oluşturulan Görseller - Tarih Bazlı */}
                         <div className="space-y-8">
                           {Object.entries(groupedByDate).map(([dateKey, items]: [string, any[]]) => (
                             <div key={dateKey} className="space-y-4">
                               <div className="flex items-center gap-3 px-2">
                                 <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                                 <div className="flex items-center gap-2">
                                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">{dateKey}</h3>
                                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">({items.length} görsel)</span>
                                 </div>
                                 <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                               </div>
                               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 px-1">
                                 {items.map((item: any) => {
                              const isSelected = state.selectedItems.includes(item.id);
                              return (
                               <div 
                                 key={item.id} 
                                 onClick={(e) => {
                                   if (state.isSelectionMode) {
                                     e.stopPropagation();
                                     setState(p => ({
                                       ...p,
                                       selectedItems: isSelected
                                         ? p.selectedItems.filter(id => id !== item.id)
                                         : [...p.selectedItems, item.id]
                                     }));
                                   }
                                 }}
                                 className={`aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden border-2 transition-all shadow-2xl relative cursor-pointer ${isSelected ? 'border-indigo-500 scale-105 ring-2 ring-indigo-500/50' : 'border-white/5 group hover:scale-[1.05]'}`}
                               >
                                 {/* Selection Checkbox */}
                                 {state.isSelectionMode && (
                                   <div className={`absolute top-4 left-4 z-20 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-400' : 'bg-black/50 border-white/30'}`}>
                                     {isSelected && <span className="text-white text-xs">✓</span>}
                                   </div>
                                 )}
                                 {item.url.startsWith('blob:') || item.url.includes('.mp4') ? <video src={item.url} autoPlay loop muted className="w-full h-full object-cover" /> : <img src={item.url} className="w-full h-full object-cover" />}
                                 <div className={`absolute inset-0 bg-black/90 transition-all flex flex-col justify-end p-6 gap-3 backdrop-blur-sm ${state.isSelectionMode ? 'opacity-50' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <div className="text-[10px] font-black text-white truncate mb-1 uppercase tracking-tighter border-b border-white/10 pb-1">{item.name}</div>
                                    <div className="text-[9px] text-slate-400 mb-2">{new Date(item.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                       <button onClick={() => setSelectedMedia({url: item.url, type: (item.url.startsWith('blob:') ? 'video' : 'photo')})} className="py-3.5 bg-white text-black rounded-2xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all">GÖR</button>
                                       <a href={item.url} download={`${item.name}.${item.url.includes('blob') ? 'mp4' : 'png'}`} onClick={e => e.stopPropagation()} className="py-3.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all">
                                         <DownloadIcon /> AL
                                       </a>
                                    </div>
                                    {/* Referans ve çıkart butonları */}
                                    {(() => {
                                      const isVideo = item.url.startsWith('blob:') || item.url.includes('.mp4');
                                      
                                      if (isVideo) {
                                        // Video için sadece albümden çıkart
                                        return (
                                          <button onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              await supabaseService.unarchiveVideo(item.id);
                                              
                                              setState(prev => {
                                                const videoItem = prev.archivedVideos.find(v => v.id === item.id);
                                                if (!videoItem) return prev;
                                                
                                                return {
                                                  ...prev,
                                                  activeTab: 'video',
                                                  activeCharacterId: item.characterId,
                                                  archivedVideos: prev.archivedVideos.filter(v => v.id !== item.id),
                                                  videoHistory: [videoItem, ...prev.videoHistory]
                                                };
                                              });
                                            } catch (error) {
                                              // Arşivden çıkarma hatası
                                              setState(prev => ({ ...prev, error: 'Albümden çıkarılamadı.' }));
                                            }
                                          }} className="w-full py-3.5 bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-500 transition-all">
                                            <LayoutGridIcon /> ALBÜMDEN ÇIKART
                                          </button>
                                        );
                                      } else {
                                        // Görsel için referans ve çıkart butonları
                                        return (
                                          <>
                                            {/* Fotoğraf referansı */}
                                            <button onClick={(e) => {
                                              e.stopPropagation();
                                              setState(prev => ({
                                                ...prev,
                                                activeTab: 'photo',
                                                styleReferenceImage: item.url,
                                                activeCharacterId: item.characterId
                                              }));
                                            }} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all">
                                              <CameraIcon /> FOTOĞRAF REFERANSI
                                            </button>
                                            {/* Video referansı */}
                                            <button onClick={(e) => {
                                              e.stopPropagation();
                                              setState(prev => ({
                                                ...prev,
                                                activeTab: 'video',
                                                videoReferenceImage: item.url,
                                                activeCharacterId: item.characterId
                                              }));
                                            }} className="w-full py-3.5 bg-purple-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-purple-500 transition-all">
                                              <VideoIcon /> VİDEO REFERANSI
                                            </button>
                                            {/* Albümden çıkart */}
                                            <button onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await supabaseService.unarchiveImage(item.id);
                                                
                                                setState(prev => {
                                                  const imageItem = prev.archivedImages.find(img => img.id === item.id);
                                                  if (!imageItem) return prev;
                                                  
                                                  return {
                                                    ...prev,
                                                    activeTab: 'photo',
                                                    activeCharacterId: item.characterId,
                                                    archivedImages: prev.archivedImages.filter(img => img.id !== item.id),
                                                    history: [imageItem, ...prev.history]
                                                  };
                                                });
                                              } catch (error) {
                                                // Arşivden çıkarma hatası
                                                setState(prev => ({ ...prev, error: 'Albümden çıkarılamadı.' }));
                                              }
                                            }} className="w-full py-3.5 bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-500 transition-all">
                                              <LayoutGridIcon /> ALBÜMDEN ÇIKART
                                            </button>
                                          </>
                                        );
                                      }
                                    })()}
                                    <button onClick={async () => {
                                      try {
                                        if (item.url.startsWith('blob:') || item.url.includes('.mp4')) {
                                          await supabaseService.deleteVideo(item.id);
                                        } else {
                                          await supabaseService.deleteImage(item.id);
                                        }
                                        setState(p => ({
                                      ...p, 
                                      archivedImages: p.archivedImages.filter(h => h.id !== item.id),
                                      archivedVideos: p.archivedVideos.filter(v => v.id !== item.id)
                                        }));
                                      } catch (error) {
                                        // Arşiv silme hatası
                                        setState(p => ({ ...p, error: 'Dosya silinemedi.' }));
                                      }
                                    }} className="w-full py-2 text-red-500/60 text-[8px] font-black uppercase hover:text-red-500">DOSYAYI SİL</button>
                                 </div>
                              </div>
                              );
                            })}
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    );
                  })()}
               </div>
             ) : (
               state.activeTab === 'quick' ? (
                    <div className="h-full flex flex-col relative">
                      {/* Chat Messages Area */}
                      <div className="flex-1 overflow-y-auto space-y-6 pt-8 pb-40 custom-scrollbar min-h-0">
                        {state.quickHistory.length === 0 && !state.isProcessing && !state.quickReferenceImage && (
                          <div className="h-full flex items-center justify-center min-h-[60vh]">
                            <div className="text-center space-y-6 max-w-md mx-auto px-6">
                              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border-2 border-dashed border-white/10 flex items-center justify-center mx-auto text-white/20">
                                <MagicIcon />
                              </div>
                              <div className="space-y-3">
                                <div className="text-3xl font-black text-white/30 uppercase tracking-tighter">Görsel Yok</div>
                                <div className="text-sm text-slate-500 leading-relaxed">Görsel oluşturmak için alttaki alana prompt yazın</div>
                              </div>
                            </div>
                          </div>
                        )}


                        {/* Chat Messages - Kullanıcı Prompt + AI Yanıtı */}
                        {state.quickHistory.filter(img => img.url && img.url.trim() !== '').map((img) => (
                          <div key={img.id} className="space-y-4 max-w-4xl mx-auto px-6">
                            {/* Kullanıcı Mesajı (Prompt) */}
                            <div className="flex gap-4 justify-end animate-in slide-in-from-bottom-4">
                              <div className="flex-1 max-w-[80%]">
                                <div className="bg-indigo-600/20 rounded-2xl p-4 border border-indigo-500/20 ml-auto">
                                  <p className="text-sm text-white">{img.prompt}</p>
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white/10">
                                <MagicIcon />
                              </div>
                            </div>

                            {/* AI Yanıtı (Görsel) */}
                            <div className="flex gap-4 animate-in slide-in-from-bottom-4">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white/10">
                                <MagicIcon />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5">
                                  <img 
                                    src={img.url} 
                                    className="w-full max-w-sm rounded-xl border border-white/10 cursor-zoom-in" 
                                    onClick={() => setSelectedMedia({url: img.url, type: 'photo'})}
                                  />
                                </div>
                                <div className="flex gap-2 text-xs flex-wrap">
                                  <a href={img.url} download={`${img.name}.png`} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-slate-400 hover:text-white transition-all">İndir</a>
                                  <button onClick={() => {
                                    // Hızlı görseller veritabanında tutulmuyor - sadece state'ten kaldır
                                    setState(p => ({...p, quickHistory: p.quickHistory.filter(h => h.id !== img.id), error: 'Görsel silindi ✓'}));
                                    setTimeout(() => setState(p => ({...p, error: null})), 2000);
                                  }} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-all">Sil</button>
                                  <button onClick={async () => {
                                    await archiveItem(img.id, 'photo');
                                    // archiveItem içinde zaten feedback var, burada tekrar eklemiyoruz
                                  }} className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all">Albüme Gönder</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Loading Message - Kullanıcı Prompt Mesajı + AI Loading */}
                        {state.isProcessing && state.processingType === 'photo' && state.quickHistory.length > 0 && state.quickHistory[0].url === '' && (
                          <div className="space-y-4 max-w-4xl mx-auto px-6">
                            {/* Kullanıcı Prompt Mesajı - quickHistory'deki geçici mesajı göster */}
                            <div className="flex gap-4 justify-end animate-in slide-in-from-bottom-4">
                              <div className="flex-1 max-w-[80%]">
                                <div className="bg-indigo-600/20 rounded-2xl p-4 border border-indigo-500/20 ml-auto">
                                  <p className="text-sm text-white">{state.quickHistory[0].prompt}</p>
                                  {state.quickReferenceImage && (
                                    <p className="text-xs text-indigo-400 mt-2">+ Referans görsel kullanılıyor</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white/10">
                                <MagicIcon />
                              </div>
                            </div>

                            {/* AI Loading Yanıtı */}
                            <div className="flex gap-4 animate-in slide-in-from-bottom-4">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white/10">
                                <MagicIcon />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm text-slate-400">Görsel oluşturuluyor...</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat Input - Fixed at Bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-[#020617] border-t border-white/10 pt-4 pb-6 z-10">
                        <div className="max-w-4xl mx-auto px-6 bg-slate-900/60 rounded-2xl border border-white/10 p-4 space-y-3">
                          {/* Input Row */}
                          <div className="flex gap-3 items-center">
                            <button
                              onClick={() => quickInputRef.current?.click()}
                              className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all relative"
                            >
                              <UploadIcon />
                              {state.quickReferenceImage && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#020617]"></div>
                              )}
                            </button>
                            {state.quickReferenceImage && (
                              <button 
                                onClick={() => setState(p => ({...p, quickReferenceImage: null}))} 
                                className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 hover:text-red-300 text-xs transition-all"
                              >
                                Referansı Kaldır
                              </button>
                            )}
                            <input
                              type="file"
                              ref={quickInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file || !file.type.startsWith('image/')) {
                                  e.target.value = '';
                                  setState(p => ({...p, error: 'Geçersiz dosya formatı. Lütfen bir görsel seçin.'}));
                                  setTimeout(() => setState(p => ({...p, error: null})), 3000);
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const dataUrl = reader.result as string;
                                  if (dataUrl) {
                                    setState(p => ({...p, quickReferenceImage: dataUrl, error: 'Referans görsel eklendi ✓'}));
                                    setTimeout(() => setState(p => ({...p, error: null})), 2000);
                                  }
                                  e.target.value = '';
                                };
                                reader.onerror = () => {
                                  setState(p => ({...p, error: 'Görsel yüklenirken hata oluştu.'}));
                                  setTimeout(() => setState(p => ({...p, error: null})), 3000);
                                  e.target.value = '';
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <input
                              type="text"
                              value={state.quickPrompt}
                              onChange={(e) => setState(p => ({...p, quickPrompt: e.target.value}))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && state.quickPrompt.trim()) {
                                  e.preventDefault();
                                  handleQuickGenerate();
                                }
                              }}
                              placeholder="Görsel oluşturmak için prompt yazın"
                              className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                            />
                            <button
                              onClick={handleQuickGenerate}
                              disabled={!state.quickPrompt.trim() || (state.isProcessing && state.processingType === 'photo')}
                              className={`flex-shrink-0 px-6 py-3 rounded-xl font-black text-xs uppercase transition-all ${
                                !state.quickPrompt.trim() || (state.isProcessing && state.processingType === 'photo')
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30'
                              }`}
                            >
                              {state.isProcessing && state.processingType === 'photo' ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                              ) : (
                                'OLUŞTUR'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
               </div>
             ) : (
               <div className="space-y-10">
                  {/* Active Rendering Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
                    {/* Empty State - Profesyonel ve minimal */}
                  {((state.activeTab === 'photo' && state.history.length === 0) ||
                    (state.activeTab === 'video' && state.videoHistory.length === 0)) && !state.isProcessing && (
                      <div className="col-span-full">
                        <div className="relative flex items-center justify-center min-h-[70vh] py-20 px-12">
                          {/* Dış çizgiler - Alanı belirten border */}
                          <div className="absolute inset-0 rounded-3xl border-2 border-dashed border-white/10 hover:border-white/20 transition-all">
                            <div className="absolute top-0 left-0 w-full h-full rounded-3xl border border-indigo-500/20 opacity-50"></div>
                          </div>
                          
                          {/* İçerik */}
                          <div className="relative text-center space-y-6 max-w-lg z-10">
                            {/* Text */}
                            <div className="space-y-2">
                              <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                                {state.activeTab === 'photo' ? 'Görselleriniz Burada Gözükecek' : 'Videolarınız Burada Gözükecek'}
                              </h3>
                              <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                                Karakteri seçin ve prompt yazarak {state.activeTab === 'photo' ? 'ilk görselinizi' : 'ilk videonuzu'} oluşturun
                              </p>
                            </div>
                            
                            {/* Subtle divider */}
                            <div className="flex items-center justify-center gap-4 pt-4">
                              <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40"></div>
                              <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                            </div>
                          </div>
                       </div>
                    </div>
                  )}

                    {state.isProcessing && state.processingType === state.activeTab && (
                       <div className="aspect-[9/16] bg-slate-900/60 rounded-[3.5rem] border border-indigo-500/20 flex flex-col items-center justify-center animate-pulse relative overflow-hidden shadow-2xl">
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent animate-shimmer"></div>
                          <div className="w-16 h-16 border-[5px] border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <div className="mt-8 text-center px-6">
                            <span className="text-lg font-black text-indigo-400 uppercase tracking-[0.4em] block">RENDERING</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 block animate-pulse">DNA İşleniyor...</span>
                          </div>
                       </div>
                    )}


                    {state.activeTab === 'photo' && state.history.map(img => (
                      <div key={img.id} className="group bg-slate-900 rounded-[3.5rem] overflow-hidden border border-white/5 relative shadow-2xl transition-all hover:scale-[1.02]">
                         <div className="aspect-[9/16] cursor-zoom-in" onClick={() => setSelectedMedia({url: img.url, type: 'photo'})}>
                            <img src={img.url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all p-8 flex flex-col justify-end gap-3 backdrop-blur-[2px] translate-y-6 group-hover:translate-y-0">
                               <div className="text-[12px] font-black text-white uppercase tracking-tighter truncate border-b border-white/10 pb-2 mb-2">{img.name}</div>
                               <div className="grid grid-cols-1 gap-3">
                                  <button onClick={(e) => { e.stopPropagation(); archiveItem(img.id, 'photo'); }} className="w-full py-4 bg-indigo-600 text-white rounded-[1.75rem] text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-500 shadow-indigo-600/20 transition-all"><LayoutGridIcon /> ARŞİVE GÖNDER</button>
                                  <button onClick={(e) => { e.stopPropagation(); setState(p => ({...p, activeTab: 'video', videoReferenceImage: img.url})); }} className="w-full py-4 bg-purple-600 text-white rounded-[1.75rem] text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-purple-500 transition-all"><VideoIcon /> VİDEO YAP</button>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                 <a href={img.url} download={`${img.name}.png`} onClick={e => e.stopPropagation()} className="py-4 bg-white text-black rounded-[1.5rem] text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200 shadow-xl transition-all">
                                   <DownloadIcon /> İNDİR
                                 </a>
                                 <button onClick={(e) => { e.stopPropagation(); setState(p => ({...p, styleReferenceImage: img.url})); }} className="py-4 bg-slate-800 text-white rounded-[1.5rem] text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                                   <MagicIcon /> DÜZENLE
                                 </button>
                               </div>
                               <button onClick={async (e) => { 
                                 e.stopPropagation(); 
                                 try {
                                   await supabaseService.deleteImage(img.id);
                                   setState(p => ({...p, history: p.history.filter(h => h.id !== img.id)}));
                                 } catch (error) {
                                   // Görsel silme hatası
                                   setState(p => ({ ...p, error: 'Görsel silinemedi.' }));
                                 }
                               }} className="w-full py-3 bg-red-600/90 hover:bg-red-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:shadow-red-600/20 transition-all mt-2">
                                 <DeleteIcon /> SİL
                               </button>
                            </div>
                         </div>
                      </div>
                    ))}

                    {state.activeTab === 'video' && state.videoHistory.filter(h => h.characterId === state.activeCharacterId).map(vid => (
                      <div key={vid.id} className="group bg-slate-900 rounded-[3.5rem] overflow-hidden border border-white/5 relative shadow-2xl transition-all hover:scale-[1.02]">
                         <div className="aspect-[9/16] cursor-zoom-in" onClick={() => setSelectedMedia({url: vid.url, type: 'video'})}>
                            <video src={vid.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                            <div className="absolute inset-0 bg-black/95 opacity-0 group-hover:opacity-100 transition-all p-8 flex flex-col items-center justify-center gap-4 backdrop-blur-xl">
                               <div className="text-[12px] font-black text-white uppercase tracking-tighter truncate mb-4">{vid.name}</div>
                               <button onClick={(e) => { e.stopPropagation(); archiveItem(vid.id, 'video'); }} className="w-full py-5 bg-purple-600 text-white rounded-[2rem] text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-2xl hover:bg-purple-500 transition-all shadow-purple-600/20"><LayoutGridIcon /> ARŞİVE KAYDET</button>
                               <a href={vid.url} download={`${vid.name}.mp4`} onClick={e => e.stopPropagation()} className="w-full py-5 bg-white text-black rounded-[2rem] text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-slate-200 transition-all">
                                 <DownloadIcon /> İNDİR
                               </a>
                               <button onClick={async (e) => { 
                                 e.stopPropagation(); 
                                 try {
                                   await supabaseService.deleteVideo(vid.id);
                                   setState(p => ({...p, videoHistory: p.videoHistory.filter(v => v.id !== vid.id)}));
                                 } catch (error) {
                                   // Video silme hatası
                                   setState(p => ({ ...p, error: 'Video silinemedi.' }));
                                 }
                               }} className="text-slate-600 hover:text-red-500 transition-all font-black text-[10px] uppercase mt-4">SİL</button>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
                  )
             )}
           </div>
        </section>
      </main>


      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.4); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.7); }

        @keyframes shimmer { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        .animate-shimmer { animation: shimmer 2.5s infinite linear; }
        @keyframes float { 0%, 100% { transform: translateY(0) rotate(12deg); } 50% { transform: translateY(-15px) rotate(12deg); } }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .scale-in-center { animation: scale-in-center 0.4s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
        @keyframes scale-in-center { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }

        body { overflow: hidden; height: 100vh; background-color: #020617; }
        * { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
};

export default App;
