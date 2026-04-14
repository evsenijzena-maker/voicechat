"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const ADMIN_NICKNAME = "prostosparky";

export default function AdminPage() {
  const { user, userData, loading, updateUserData } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<{uid: string; nickname: string; coins: number; eggs: number; verified: boolean; premium: boolean}[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [amount, setAmount] = useState(100);
  const [action, setAction] = useState<"add_coins" | "add_eggs" | "verify" | "premium">("add_coins");
  const [message, setMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (userData?.nickname === ADMIN_NICKNAME) {
        setIsAdmin(true);
        loadUsers();
      } else {
        router.push("/app");
      }
    }
  }, [user, userData, loading, router]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { db } = getFirebase();
      if (!db) return;

      const { getDocs, collection } = await import("firebase/firestore");
      const snapshot = await getDocs(collection(db, "users"));
      
      const usersList: {uid: string; nickname: string; coins: number; eggs: number; verified: boolean; premium: boolean}[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          uid: doc.id,
          nickname: data.nickname,
          coins: data.coins || 0,
          eggs: data.eggs || 0,
          verified: data.verified || false,
          premium: data.premium || false,
        });
      });
      setUsers(usersList);
    } catch (e) {
      console.error("Error loading users:", e);
    }
    setLoadingUsers(false);
  };

  const executeAction = async () => {
    if (!selectedUser) {
      setMessage("Оберіть користувача!");
      return;
    }

    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { db } = getFirebase();
      if (!db) return;

      const { doc, getDoc, updateDoc, increment } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(db, "users", selectedUser));
      
      if (!userDoc.exists()) {
        setMessage("Користувача не знайдено!");
        return;
      }

      const userDataDoc = userDoc.data();

      switch (action) {
        case "add_coins":
          await updateDoc(doc(db, "users", selectedUser), { coins: increment(amount) });
          setMessage(`Додано ${amount} монет користувачу ${userDataDoc.nickname}!`);
          break;
        case "add_eggs":
          await updateDoc(doc(db, "users", selectedUser), { eggs: increment(amount) });
          setMessage(`Додано ${amount} яєць користувачу ${userDataDoc.nickname}!`);
          break;
        case "verify":
          await updateDoc(doc(db, "users", selectedUser), { verified: true });
          setMessage(`Користувач ${userDataDoc.nickname} верифікований!`);
          break;
        case "premium":
          await updateDoc(doc(db, "users", selectedUser), { premium: true });
          setMessage(`Користувач ${userDataDoc.nickname} отримав преміум!`);
          break;
      }

      loadUsers();
    } catch (e) {
      console.error("Error:", e);
      setMessage("Помилка!");
    }

    setTimeout(() => setMessage(""), 3000);
  };

  if (loading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container" style={{ minHeight: "100vh", padding: "16px" }}>
      <header style={{ padding: "12px 0", marginBottom: 16 }}>
        <button onClick={() => router.push("/app")} className="btn btn-secondary" style={{ padding: "8px 12px" }}>
          ← Назад
        </button>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="title" style={{ textAlign: "center" }}>⚙️ Адмін-панель</h2>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Дія:</h3>
        
        <select 
          value={action} 
          onChange={(e) => setAction(e.target.value as typeof action)}
          className="input"
          style={{ marginBottom: 12 }}
        >
          <option value="add_coins">Додати монети</option>
          <option value="add_eggs">Додати яйця</option>
          <option value="verify">Дати верифікацію</option>
          <option value="premium">Дати преміум</option>
        </select>

        {(action === "add_coins" || action === "add_eggs") && (
          <input
            type="number"
            className="input"
            placeholder="Кількість"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ marginBottom: 12 }}
          />
        )}

        <select 
          value={selectedUser} 
          onChange={(e) => setSelectedUser(e.target.value)}
          className="input"
          style={{ marginBottom: 12 }}
        >
          <option value="">Оберіть користувача</option>
          {users.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.nickname} ({u.coins}🪙 {u.eggs}🥚) {u.verified ? "✓" : ""} {u.premium ? "⭐" : ""}
            </option>
          ))}
        </select>

        <button onClick={executeAction} className="btn btn-primary w-full">
          Виконати
        </button>

        {message && (
          <p className="text-center mt-4" style={{ color: message.includes("✓") || message.includes("!") ? "var(--accent)" : "var(--error)" }}>
            {message}
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Всі користувачі:</h3>
        {loadingUsers ? (
          <div className="spinner" style={{ margin: "0 auto" }}></div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {users.map((u) => (
              <div key={u.uid} style={{ padding: 8, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span>{u.nickname}</span>
                <span>
                  {u.verified && "✓ "}
                  {u.premium && "⭐ "}
                  {u.coins}🪙 {u.eggs}🥚
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}