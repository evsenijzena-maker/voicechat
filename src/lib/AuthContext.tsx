"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface UserData {
  nickname: string;
  verified: boolean;
  premium: boolean;
  createdAt: Date;
  isOnline: boolean;
  lastSeen: Date;
  coins: number;
  eggs: number;
  inventory: string[];
  nameColor?: string;
}

interface AuthContextType {
  user: unknown | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addEggs: (amount: number) => Promise<void>;
  spendCoins: (amount: number) => Promise<boolean>;
  spendEggs: (amount: number) => Promise<boolean>;
  buyItem: (itemId: string, price: number, currency: 'coins' | 'eggs', isLimited: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<unknown | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInstance, setAuthInstance] = useState<ReturnType<typeof import("firebase/auth").getAuth> | null>(null);
  const [dbInstance, setDbInstance] = useState<ReturnType<typeof import("firebase/firestore").getFirestore> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import("firebase/auth");
        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const { getFirebase } = await import("./firebase");
        
        const { auth: authObj, db: dbObj } = getFirebase();
        
        if (!authObj || !dbObj) {
          if (isMounted) setLoading(false);
          return;
        }

        setAuthInstance(authObj as ReturnType<typeof getAuth>);
        setDbInstance(dbObj as ReturnType<typeof getFirestore>);

        const unsubscribe = onAuthStateChanged(authObj as ReturnType<typeof getAuth>, async (currentUser) => {
          if (!isMounted) return;
          
          setUser(currentUser);
          
          if (currentUser) {
            try {
              const userDoc = await getDoc(doc(dbObj as ReturnType<typeof getFirestore>, "users", currentUser.uid));
              if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData({
                  nickname: data.nickname,
                  verified: data.verified || false,
                  premium: data.premium || false,
                  createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                  isOnline: data.isOnline,
                  lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : new Date(),
                  coins: data.coins || 0,
                  eggs: data.eggs || 0,
                  inventory: data.inventory || [],
                  nameColor: data.nameColor,
                });
              }
            } catch (e) {
              console.error("Error fetching user data:", e);
            }
          } else {
            setUserData(null);
          }
          
          if (isMounted) setLoading(false);
        });

        return () => {
          isMounted = false;
          unsubscribe();
        };
      } catch (error) {
        console.error("Firebase init error:", error);
        if (isMounted) setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signOut = async () => {
    if (authInstance) {
      const { signOut: firebaseSignOut } = await import("firebase/auth");
      await firebaseSignOut(authInstance);
    }
  };

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user || !dbInstance) return;
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(dbInstance, "users", (user as { uid: string }).uid), data, { merge: true });
    setUserData(prev => prev ? { ...prev, ...data } : null);
  };

  const addCoins = async (amount: number) => {
    if (!user || !dbInstance) return;
    const newCoins = (userData?.coins || 0) + amount;
    await updateUserData({ coins: newCoins });
  };

  const addEggs = async (amount: number) => {
    if (!user || !dbInstance) return;
    const newEggs = (userData?.eggs || 0) + amount;
    await updateUserData({ eggs: newEggs });
  };

  const spendCoins = async (amount: number): Promise<boolean> => {
    if (!userData || userData.coins < amount) return false;
    const newCoins = userData.coins - amount;
    await updateUserData({ coins: newCoins });
    return true;
  };

  const spendEggs = async (amount: number): Promise<boolean> => {
    if (!userData || userData.eggs < amount) return false;
    const newEggs = userData.eggs - amount;
    await updateUserData({ eggs: newEggs });
    return true;
  };

  const COLOR_MAP: Record<string, string> = {
  'color_red': '#ef4444',
  'color_blue': '#3b82f6',
  'color_green': '#22c55e',
  'color_pink': '#ec4899',
  'color_orange': '#f97316',
  'color_purple': '#a855f7',
  'gold_theme': '#f59e0b',
};

const buyItem = async (itemId: string, price: number, currency: 'coins' | 'eggs', isLimited: boolean): Promise<boolean> => {
    if (!userData) return false;
    
    const currentBalance = currency === 'coins' ? userData.coins : userData.eggs;
    if (currentBalance < price) return false;
    
    if (isLimited && userData.inventory.includes(itemId)) {
      return false;
    }

    if (currency === 'coins') {
      await spendCoins(price);
    } else {
      await spendEggs(price);
    }

    const newInventory = [...userData.inventory, itemId];
    
    const color = COLOR_MAP[itemId];
    if (color) {
      await updateUserData({ inventory: newInventory, nameColor: color });
    } else {
      await updateUserData({ inventory: newInventory });
    }
    return true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      signOut, 
      updateUserData,
      addCoins,
      addEggs,
      spendCoins,
      spendEggs,
      buyItem
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}