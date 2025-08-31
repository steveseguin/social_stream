const fs = require('fs');

function loadJSON(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }
function saveJSON(path, obj) { fs.writeFileSync(path, JSON.stringify(obj, null, 2)); }

const tr = loadJSON('translations/tr.json');
if (!tr.innerHTML) tr.innerHTML = {};

const U = {
  "tts-espeak-options": "eSpeak TTS Seçenekleri",
  "compact-topbar": "📐 Kompakt mod (daha küçük yükseklik)",
  "realtime-updates": "⚡ Gerçek zamanlı güncellemeler",
  "max-users-display": "Gösterilecek maksimum kullanıcı sayısı",
  "tts-filters": "TTS Filtreleri",
  "show-points-value": "🔢 Puan değerlerini göster",
  "show-source-name": "📝 Simgenin yanında kaynak adını metin olarak göster",
  "theme-style-scoreboard": "Tema stili",
  "show-platform-icon": "🌐 Platform simgelerini göster",
  "include-weekly": "📆 Haftalık istatistikleri dahil et (varsayılan: yalnız günlük)",
  "noavatarifmissing": "🚫👤 Yer tutucu avatar kullanma",
  "pitch": "📯 Ton:",
  "enable-points-command": "!points komutunu etkinleştir",
  "tts-openai-options": "OpenAI TTS Seçenekleri",
  "points-system": "🏆 Puan Sistemi",
  "tts-piper-options": "Piper TTS Seçenekleri",
  "theme-and-data": "Tema ve Veri Ayarları",
  "reset-all-points": "Tüm Puanları Sıfırla",
  "obs-websocket-info": "💡 OBS'i kontrol etmek için Flow Actions'a izin vermek amacıyla burada OBS WebSocket ayarlarınızı yapılandırın. OBS'te WebSocket Sunucusunun etkin olduğundan emin olun: Tools → WebSocket Server Settings",
  "points-eventflow-info": "💡 Kullanıcılar Event Flow sistemi aracılığıyla puan harcayabilir. Ödülleri ve eylemleri Event Flow düzenleyicisinde yapılandırın.",
  "topbar-note": "Bu ayarlar yalnızca \"Top Header Bar\" yerleşiminde geçerlidir",
  "scoreboard-title": "> Özel skor tablosu başlığı",
  "openai-model": "🤖 Model tts-1 (daha hızlı) tts-1-hd (daha yüksek kalite) Özel",
  "obs-websocket-password": "> OBS WebSocket Parolası",
  "enable-leaderboard-command": "!leaderboard komutunu etkinleştir",
  "rotation-interval": "🔄 Döndürme aralığı (saniye)",
  "spotify-client-id": "> Spotify İstemci Kimliği",
  "minimum-points": "> Minimum puan eşiği",
  "points-triggers": "Puan Tetikleyicileri",
  "altselect": "🖱️ Sağ tık menüsünden manuel seçim gerekir",
  "pump-the-numbers": "📈 İzleyici sayısını 1.75× ile çarp",
  "show-menu-bar": "Menü çubuğunu zorla göster (MELD ile?)",
  "enable-animations-scoreboard": "✨ Animasyonları etkinleştir",
  "openai-endpoint": "Özel API Uç Noktası (isteğe bağlı)",
  "discord-memberships": "🌠 Discord rollerini Üyelik olarak değerlendir",
  "spotify-integration": "🎵 Spotify Entegrasyonu",
  "spotify-client-secret": "> Spotify İstemci Sırrı",
  "duration-speed": "⌚ Süre ×",
  "quick-tts": "🔤 Yalnızca ilk 100 karakteri oku",
  "spotify-announce-new-track": "Yeni şarkıları sohbette duyur",
  "ticker-scroll-speed": "Kaydırma Hızı",
  "show-user-avatar": "👤 Kullanıcı avatarlarını göster",
  "make-overlay-larger": "🔍➕ Kaplamayı büyüt ",
  "enable-tts-featured": "Öne Çıkan Sohbette TTS'i etkinleştir",
  "rotation-includes": "Döndürmede şunları dahil et:",
  "scoreboard": "Skor Tablosu (🚧 Yapım Aşamasında)",
  "only-show-big-donos": "🤑 5$ altındaki bağışları gizle",
  "spotify-announce-format": "> Duyuru biçimi",
  "enable-midi-to-see-devices": "Cihazları görmek için yukarıdaki MIDI kısayollarını etkinleştir",
  "add-sentiment-scores-to-messages": "😈😇 Mesajlara duygu puanları ekle ",
  "vdoninjadiscord": "Discord'da canlı videolara görüntü bağlantıları ekle",
  "enable-rewards-command": "!rewards komutunu etkinleştir",
  "engagement-window": "Etkileşim penceresi (dakika):",
  "update-behavior": "Güncelleme Davranışı",
  "rotation-and-display": "Üst Çubuk Ayarları",
  "smooth-message-buffering": "🚦 Yumuşak mesaj arabelleği (taşmaları önler)",
  "background-color": "🎨 Arka plan rengi",
  "highlight-score-changes": "📈 Puan değişikliklerini vurgula",
  "autoshowcontentimages": "😺 Otomatik seçim açıkken içerik görseli olanları seç",
  "points-per-engagement": "Etkileşim başına puan:",
  "transition-style": "Geçiş Stili",
  "manage-user-points": "Kullanıcı Puanlarını Yönet",
  "spotify-polling-interval": "Anket aralığı (saniye):",
  "enable-points-system": "Sadakat puanları sistemini etkinleştir",
  "obs-websocket-url": "> OBS WebSocket URL",
  "when-enabled-a-scoreboard": "Gerçek zamanlı puan takibi yapan bir skor tablosu. Özel tetikleyiciler ve ödüllerle kullanıcı puanlarını, sıralamaları ve etkileşim skorlarını gösterir.",
  "beep-when-there-is-a-new-donation": "🔔💵 Yeni bir bağış olduğunda bip sesi çıkar",
  "openai-api-key": "OpenAI API Anahtarı",
  "auto-queue-donations": "💵🔢 Bağış içeren mesajları otomatik sıraya al",
  "no-background-shading-for-any-questions": "❓🔦 \"Sorular\" için arka plan gölgesi yok",
  "spotify-bot-name": "> Mesajlar için bot adı",
  "theme-and-styling": "Tema ve Stil",
  "show-gift-value": "💰 Hediyeler için parasal değeri göster (adet yerine)",
  "openai-format": "🎵 Ses Formatı MP3 Opus AAC FLAC",
  "custom-point-triggers": "🎯 Özel puan tetikleyicilerini etkinleştir",
  "openai-tts-speed": "⏩ Konuşma hızı",
  "points-for-donations": "💰 Bağışlar için puan ver",
  "points-configuration": "Puan Yapılandırması",
  "battlemeter": "Battle Royale ",
  "ticker-scroll-mode": "📜 Ticker kaydırma modu (sürekli kaydırma)",
  "display-layout-scoreboard": "Yerleşim Stili",
  "topbar-category": "Görüntüleme Modu",
  "kitten-tts-speed": "⏩ Konuşma hızı",
  "tts-kitten-options": "Kitten TTS Seçenekleri",
  "obs-websocket-settings": "OBS WebSocket Ayarları",
  "enable-spotify-integration": "Spotify entegrasyonunu etkinleştir",
  "points-for-chat": "💬 Sohbet mesajları için puan ver",
  "view-points-leaderboard": "Liderliği Görüntüle",
  "spotify-now-playing": "Şu an çalan takibini etkinleştir"
};

let updated = 0;
for (const [k, v] of Object.entries(U)) {
  if (tr.innerHTML[k] !== v) {
    tr.innerHTML[k] = v;
    updated++;
  }
}

saveJSON('translations/tr.json', tr);
console.log(`Updated ${updated} Turkish translations.`);

