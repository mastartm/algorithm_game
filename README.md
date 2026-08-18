# 🤖 Algoritma Simülatörü

Blok tabanlı, görsel bir mantık/algoritma oyunu. [Human Resource Machine](https://tomorrowcorporation.com/humanresourcemachine)'dan ilham alınarak yapıldı: bir robota INBOX bandından gelen sayıları alıp işleyip OUTBOX'a teslim etmesi için "kod" yazıyorsun — ama bu kod, sürükleyip sıraladığın komut bloklarından oluşuyor.

**🔗 Canlı Demo:** https://mastartm.github.io/algorithm_game/

## 🎯 Proje Hakkında

Bu proje, algoritmik düşünmeyi (sıralama, koşul, döngüsel işlem, yığın/stack mantığı) soyut bir şekilde değil, **görsel ve interaktif** bir şekilde öğretmeyi/uygulamayı hedefliyor. Kullanıcı komutları doğru sıraya dizdiğinde robot, INBOX'tan aldığı sayıları işleyip OUTBOX'a doğru sonucu teslim ediyor.

## ✨ Özellikler

- **20 seviye**, kolaydan zora artan zorlukla (toplama/çıkarma gibi basit işlemlerden, çok adımlı zincirleme ifadelere kadar)
- **Yığın (stack) tabanlı çalışma motoru** — robotun elinde birden fazla değer aynı anda tutulabiliyor, gerçek bir mini-VM gibi çalışıyor
- **Canlı animasyonlar** — robot conveyor bandına yürüyor, sayıyı fiziksel olarak elinde taşıyor, işlem yaparken operatör rozeti (`+`, `×2`, `MAX`...) beliriyor
- **Python konsolu** — kodu çalıştırdıkça, blok dizilimin gerçek zamanlı olarak çalışan Python koduna çevrilip gerçek değerlerle konsola basılıyor; hatalı çözümlerde gerçek bir Python `Traceback`/`AssertionError` görünümünde kırmızı hata çıkıyor
- **Tuzak/çöp mekaniği** — bazı seviyelerde gereksiz, işe yaramayan bloklar var; oyuncu bunları fark edip 🗑 ile programdan çıkarmak zorunda
- **Tam responsive tasarım** — masaüstünde sürükle-bırak ile blok sıralama, mobilde ▲▼ butonlarıyla aynı işlev; mobilde "🎮 Oyun" / "💻 Kod" sekmeleri arasında geçiş
- **İlk kullanım tanıtım ekranı** — oyuna giren kullanıcıya neyin nerede olduğunu anlatan bir pop-up (istenildiğinde "?" butonuyla tekrar açılabiliyor)

## 🛠 Kullanılan Teknolojiler

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) — sürükle-bırak
- Saf CSS (framework yok) — özel animasyonlar, grid/flex düzeni
- [gh-pages](https://www.npmjs.com/package/gh-pages) — GitHub Pages deploy

## 🚀 Yerelde Çalıştırma

```bash
git clone https://github.com/mastartm/algorithm_game.git
cd algorithm_game
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

## 📁 Proje Yapısı

```
src/
├── App.jsx       # Ana bileşen: oyun motoru, animasyonlar, konsol, UI
├── App.css       # Tüm stiller (responsive + animasyonlar dahil)
└── levels.js     # 20 seviyenin tanımı (girdi/çıktı, bloklar, doğru sıra)
```

## 🧩 Nasıl Çalışıyor

- Robotun elinde tuttuğu değerler bir **yığın (stack)** olarak modelleniyor.
- `GİRDİ AL` bloğu INBOX'tan bir değeri alıp yığına ekliyor.
- İkili işlem blokları (`TOPLA`, `ÇIKAR`, `MAX`...) yığının tepesinden gereken kadar değeri çekip sonucu geri yığına koyuyor.
- `ÇIKTI VER` yığının tepesindeki değeri OUTBOX'a gönderiyor.

Bu sayede aynı bloklar zincirlenerek çok daha karmaşık ifadeler kurulabiliyor (örn. dört sayıyı toplamak için `TOPLA` bloğunu üç kez kullanmak gibi).

## 🗺 Yeni Seviye Ekleme

`src/levels.js` içine yeni bir obje eklemen yeterli:

```js
{
  id: 21,
  title: "Seviye 21: ...",
  goal: "Kullanıcıya gösterilecek görev açıklaması.",
  inputData: [/* INBOX'a gelecek sayılar */],
  expectedOutput: [/* OUTBOX'ta beklenen sonuç */],
  initialBlocks: [
    { id: "inbox", function: "GİRDİ AL", type: "io" },
    // ... diğer bloklar (karışık sırada, oyuncu doğru sıraya dizecek)
  ],
  correctOrder: ["inbox", /* ... */], // sadece dokümantasyon amaçlı
}
```

> Not: Aynı bloktan birden fazla kullanacaksan (örn. iki `TOPLA`), her birine benzersiz bir `id` ver (`add_1`, `add_2` gibi) — sürükle-bırak kütüphanesi aynı id'yi iki kez kabul etmiyor.

## 🙏 İlham Kaynağı

[Human Resource Machine](https://tomorrowcorporation.com/humanresourcemachine) (Tomorrow Corporation) — bu proje ondan ilham alınarak, tamamen bağımsız bir öğrenme/portföy çalışması olarak geliştirilmiştir.

## 📝 Lisans

MIT
