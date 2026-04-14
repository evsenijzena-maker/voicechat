"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const COLOR_ITEMS: Record<string, { name: string; color: string; icon: string }> = {
  'color_red': { name: 'Червоний', color: '#ef4444', icon: '🔴' },
  'color_blue': { name: 'Синій', color: '#3b82f6', icon: '🔵' },
  'color_green': { name: 'Зелений', color: '#22c55e', icon: '🟢' },
  'color_pink': { name: 'Рожевий', color: '#ec4899', icon: '🩷' },
  'color_orange': { name: 'Помаранчевий', color: '#f97316', icon: '🟠' },
  'color_purple': { name: 'Фіолетовий', color: '#a855f7', icon: '🟣' },
  'gold_theme': { name: 'Золотий', color: '#f59e0b', icon: '🌟' },
  'rainbow_name': { name: 'Райдужний', color: 'rainbow', icon: '🌈' },
};

export default function SettingsPage() {
  const { user, userData, loading, updateUserData } = useAuth();
  const router = useRouter();

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

  const ownedColors = userData.inventory
    .filter(id => COLOR_ITEMS[id])
    .map(id => ({ id, ...COLOR_ITEMS[id] }));

  const currentColor = userData.nameColor || '';
  const isDefault = !currentColor || currentColor === 'white';

  const handleColorSelect = async (colorId: string) => {
    if (colorId === 'white') {
      const { getFirebase } = await import("@/lib/firebase");
      const { db } = getFirebase();
      if (db && user && (user as { uid: string }).uid) {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "users", (user as { uid: string }).uid), 
          { nameColor: null }, 
          { merge: true }
        );
      }
    } else if (colorId === 'rainbow') {
      await updateUserData({ nameColor: 'rainbow' });
    } else {
      await updateUserData({ nameColor: colorId });
    }
    router.push("/app");
  };

  return (
    <div className="container" style={{ minHeight: "100vh", padding: "16px" }}>
      <header style={{ padding: "12px 0", marginBottom: 16 }}>
        <button onClick={() => router.push("/app")} className="btn btn-secondary" style={{ padding: "8px 12px" }}>
          ← Назад
        </button>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="title" style={{ textAlign: "center", marginBottom: 8 }}>⚙️ Налаштування</h2>
        
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div className="avatar" style={{ margin: '0 auto 8px', width: 60, height: 60, fontSize: 24 }}>
            {userData.nickname[0]}
          </div>
          <div style={{ 
            fontWeight: 600, 
            fontSize: 18,
            color: currentColor === 'rainbow' ? 'transparent' : 
                   (isDefault ? '#f8fafc' : currentColor),
            background: currentColor === 'rainbow' ? 
              'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00ff, #ff0000)' : undefined,
            backgroundClip: currentColor === 'rainbow' ? 'text' : undefined,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: currentColor === 'rainbow' ? 'transparent' : undefined,
          }}>
            {userData.nickname}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            {userData.premium && (
              <span className="badge badge-premium" style={{ fontSize: 16, width: 28, height: 28 }}>⭐</span>
            )}
            {userData.verified && (
              <span className="badge" style={{ fontSize: 16, width: 28, height: 28 }}>✓</span>
            )}
            {userData.inventory.includes('vip_badge') && (
              <span className="badge" style={{ fontSize: 16, width: 28, height: 28, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}>👑</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Твій колір імені:</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => handleColorSelect('white')}
            style={{
              padding: '12px 8px',
              background: isDefault ? 'var(--primary)' : 'var(--bg-elevated)',
              border: `2px solid ${isDefault ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 24 }}>⬜</span>
            <span style={{ fontSize: 11 }}>Білий</span>
          </button>

          {ownedColors.map((item) => (
            <button
              key={item.id}
              onClick={() => handleColorSelect(item.id === 'rainbow_name' ? 'rainbow' : item.color)}
              style={{
                padding: '12px 8px',
                background: currentColor === item.color || (item.id === 'rainbow_name' && currentColor === 'rainbow') ? 'var(--primary)' : 'var(--bg-elevated)',
                border: `2px solid ${currentColor === item.color || (item.id === 'rainbow_name' && currentColor === 'rainbow') ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <span style={{ fontSize: 11 }}>{item.name}</span>
            </button>
          ))}
        </div>

        {ownedColors.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Купи кольори в магазині 🛒
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Твої досягнення:</h3>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {userData.premium && (
            <div style={{ textAlign: 'center', padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 }}>
              <span style={{ fontSize: 32 }}>⭐</span>
              <div style={{ fontSize: 12, marginTop: 4 }}>Преміум</div>
            </div>
          )}
          {userData.verified && (
            <div style={{ textAlign: 'center', padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 }}>
              <span style={{ fontSize: 32 }}>✓</span>
              <div style={{ fontSize: 12, marginTop: 4 }}>Верифіковано</div>
            </div>
          )}
          {userData.inventory.includes('vip_badge') && (
            <div style={{ textAlign: 'center', padding: 12, background: 'rgba(168, 85, 247, 0.1)', borderRadius: 8 }}>
              <span style={{ fontSize: 32 }}>👑</span>
              <div style={{ fontSize: 12, marginTop: 4 }}>VIP</div>
            </div>
          )}
          {userData.coins > 0 && (
            <div style={{ textAlign: 'center', padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 }}>
              <span style={{ fontSize: 32 }}>🪙</span>
              <div style={{ fontSize: 12, marginTop: 4 }}>{userData.coins}</div>
            </div>
          )}
          {userData.eggs > 0 && (
            <div style={{ textAlign: 'center', padding: 12, background: 'rgba(236, 72, 153, 0.1)', borderRadius: 8 }}>
              <span style={{ fontSize: 32 }}>🥚</span>
              <div style={{ fontSize: 12, marginTop: 4 }}>{userData.eggs}</div>
            </div>
          )}
        </div>
      </div>

      <footer style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
        <button onClick={() => router.push("/shop")} style={{ color: 'var(--primary-light)', background: 'none', textDecoration: 'underline' }}>
          Перейти в магазин →
        </button>
      </footer>
    </div>
  );
}