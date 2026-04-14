"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

interface ShopItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  currency: 'coins' | 'eggs';
  limited: boolean;
  description: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { id: 'premium_month', name: 'Преміум 30 днів', icon: '⭐', price: 50, currency: 'eggs', limited: true, description: 'Преміум статус на місяць' },
  { id: 'color_red', name: 'Червоний колір', icon: '🔴', price: 25, currency: 'coins', limited: false, description: 'Червоний колір імені' },
  { id: 'color_blue', name: 'Синій колір', icon: '🔵', price: 25, currency: 'coins', limited: false, description: 'Синій колір імені' },
  { id: 'color_green', name: 'Зелений колір', icon: '🟢', price: 25, currency: 'coins', limited: false, description: 'Зелений колір імені' },
  { id: 'color_pink', name: 'Рожевий колір', icon: '🩷', price: 25, currency: 'coins', limited: false, description: 'Рожевий колір імені' },
  { id: 'color_orange', name: 'Помаранчевий', icon: '🟠', price: 25, currency: 'coins', limited: false, description: 'Помаранчевий колір імені' },
  { id: 'color_purple', name: 'Фіолетовий колір', icon: '🟣', price: 25, currency: 'coins', limited: false, description: 'Фіолетовий колір імені' },
  { id: 'gold_theme', name: 'Золота тема', icon: '🌟', price: 200, currency: 'coins', limited: false, description: 'Золотий колір імені в чаті' },
  { id: 'rainbow_name', name: 'Райдужний нік', icon: '🌈', price: 150, currency: 'coins', limited: false, description: 'Райдужний колір імені' },
  { id: 'extra_egg', name: '+1 Пасхальне яйце', icon: '🥚', price: 30, currency: 'coins', limited: false, description: 'Отримай 1 пасхальне яйце' },
  { id: 'extra_coins', name: '+10 Монет', icon: '🪙', price: 5, currency: 'eggs', limited: false, description: 'Отримай 10 монет' },
  { id: 'secret_emoji', name: 'Секретний емодзі', icon: '🎁', price: 75, currency: 'eggs', limited: true, description: 'Невідомий бонус' },
  { id: 'vip_badge', name: 'VIP статус', icon: '👑', price: 500, currency: 'eggs', limited: true, description: 'VIP статус' },
];

export default function ShopPage() {
  const { userData, buyItem, loading } = useAuth();
  const router = useRouter();
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (loading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!userData) {
    router.push("/");
    return null;
  }

  const handleBuy = async (item: ShopItem) => {
    setBuying(item.id);
    setMessage("");
    
    const success = await buyItem(item.id, item.price, item.currency, item.limited);
    
    if (success) {
      setMessage(`✅ Куплено: ${item.name}!`);
    } else {
      if (userData.inventory.includes(item.id)) {
        setMessage("❌ Цей предмет вже куплено!");
      } else {
        const balance = item.currency === 'coins' ? userData.coins : userData.eggs;
        setMessage(`❌ Недостатньо ${item.currency === 'coins' ? 'монет' : 'яєць'}!`);
      }
    }
    
    setBuying(null);
    setTimeout(() => setMessage(""), 5000);
  };

  const isOwned = (itemId: string) => userData.inventory.includes(itemId);
  const canAfford = (item: ShopItem) => {
    if (item.currency === 'coins') return userData.coins >= item.price;
    return userData.eggs >= item.price;
  };

  return (
    <div className="container" style={{ minHeight: "100vh", padding: "16px" }}>
      <header style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => router.push("/app")} className="btn btn-secondary" style={{ padding: "8px 12px" }}>
          ← Назад
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Магазин</h1>
        <div style={{ width: 80 }}></div>
      </header>

      <div className="balance-display">
        <div className="currency currency-coins">
          <span className="coin-icon">🪙</span>
          <span>{userData.coins ?? 0}</span>
        </div>
        <div className="currency currency-eggs">
          <span className="egg-icon">🥚</span>
          <span>{userData.eggs ?? 0}</span>
        </div>
      </div>

      {message && (
        <div className="card text-center" style={{ marginBottom: 16, padding: 12, background: message.includes("✅") ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)" }}>
          {message}
        </div>
      )}

      <div className="shop-grid">
        {SHOP_ITEMS.map((item) => {
          const owned = isOwned(item.id);
          const affordable = canAfford(item);
          
          return (
            <div 
              key={item.id} 
              className={`shop-card ${item.limited ? 'limited' : ''}`}
              style={{ opacity: owned ? 0.6 : 1 }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{item.description}</div>
              {item.limited && (
                <div style={{ fontSize: 10, color: "#ec4899", marginTop: 4, fontWeight: 600 }}>ЛІМІТОВАНО</div>
              )}
              <div className="shop-price">
                <span className={item.currency === 'coins' ? 'coin-icon' : 'egg-icon'}>
                  {item.currency === 'coins' ? '🪙' : '🥚'}
                </span>
                <span>{item.price}</span>
              </div>
              <button 
                onClick={() => handleBuy(item)}
                disabled={owned || !affordable || buying === item.id}
                className={`btn w-full mt-4 ${owned ? 'btn-secondary' : affordable ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: "8px 12px" }}
              >
                {owned ? "Куплено" : buying === item.id ? "..." : affordable ? "Купити" : "Недостатньо"}
              </button>
            </div>
          );
        })}
      </div>

      <footer style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
        Заробляй монети за кожну хвилину розмови!<br/>
        Пасхальні яйца - за особливі досягнення 🥚
      </footer>
    </div>
  );
}