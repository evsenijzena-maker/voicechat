"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/app");
    }
  }, [user, authLoading, router]);

  const checkNicknameUnique = async (nick: string): Promise<boolean> => {
    const { getFirebase } = await import("@/lib/firebase");
    const { db } = getFirebase();
    if (!db) return false;
    
    const { collection, query, where, getDocs } = await import("firebase/firestore");
    const q = query(collection(db, "users"), where("nickname", "==", nick));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { auth, db } = getFirebase();
      
      if (!auth || !db) {
        setError("Firebase не ініціалізований");
        setLoading(false);
        return;
      }

      const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import("firebase/auth");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

      let credential;
      if (isLogin) {
        credential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!nickname.trim()) {
          setError("Введіть нікнейм");
          setLoading(false);
          return;
        }
        if (nickname.length < 3 || nickname.length > 20) {
          setError("Нікнейм повинен бути від 3 до 20 символів");
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
          setError("Нікнейм може містити тільки літери, цифри та підкреслення");
          setLoading(false);
          return;
        }

        const isUnique = await checkNicknameUnique(nickname);
        if (!isUnique) {
          setError("Цей нікнейм вже зайнятий");
          setLoading(false);
          return;
        }

        credential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, "users", credential.user.uid), {
          nickname: nickname,
          verified: false,
          createdAt: serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      }

      router.push("/app");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Сталася помилка";
      if (errorMessage.includes("auth/email-already-in-use")) {
        setError("Цей email вже зареєстрований");
      } else if (errorMessage.includes("auth/invalid-email")) {
        setError("Неправильний формат email");
      } else if (errorMessage.includes("auth/weak-password")) {
        setError("Пароль повинен бути не менше 6 символів");
      } else if (errorMessage.includes("auth/invalid-credential")) {
        setError("Неправильний email або пароль");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center" style={{ minHeight: "100vh", padding: "16px" }}>
      <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "24px 20px" }}>
        <div className="text-center">
          <div className="avatar" style={{ margin: "0 auto 16px", width: 56, height: 56, fontSize: 22 }}>
            🎙️
          </div>
          <h1 className="title">VoiceChat</h1>
          <p className="subtitle">{isLogin ? "Увійдіть, щоб почати спілкування" : "Створіть акаунт"}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          {!isLogin && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Нікнейм</label>
              <input
                type="text"
                className="input"
                placeholder="Ваш нікнейм"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toLowerCase())}
                maxLength={20}
                autoComplete="username"
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">Пароль</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner"></span> : isLogin ? "Увійти" : "Зареєструватися"}
          </button>
        </form>

        <div className="divider">або</div>

        <p className="text-center" style={{ color: "var(--text-secondary)" }}>
          {isLogin ? "Немає акаунту? " : "Вже маєте акаунт? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            style={{ background: "none", color: "var(--primary-light)", fontWeight: 500 }}
          >
            {isLogin ? "Зареєструватися" : "Увійти"}
          </button>
        </p>
      </div>
    </div>
  );
}
