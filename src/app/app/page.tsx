"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { t, getLanguage, setLanguage, translations, type Language, type TranslationKey } from "@/lib/translations";

interface ChatPartner {
  uid: string;
  nickname: string;
  premium: boolean;
  verified: boolean;
}

interface CallState {
  status: "idle" | "searching" | "connecting" | "connected" | "ended";
  partner: ChatPartner | null;
}

export default function ChatPage() {
  const { user, userData, loading: authLoading, signOut, addCoins, addEggs } = useAuth();
  const router = useRouter();
  
  const [callState, setCallState] = useState<CallState>({ status: "idle", partner: null });
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [language, setLang] = useState<Language>("uk");
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedLang = getLanguage();
    setLang(savedLang);
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    setLang(lang);
  };
  
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError(t("micError"));
      return null;
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const findPartner = async () => {
    setError("");
    setCallState({ status: "searching", partner: null });
    
    const stream = await startLocalStream();
    if (!stream) {
      setCallState({ status: "idle", partner: null });
      return;
    }

    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { rtdb, db } = getFirebase();
      
      if (!rtdb || !db || !user) {
        setError(t("fbError"));
        setCallState({ status: "idle", partner: null });
        stopLocalStream();
        return;
      }

      const { ref, set, push, onValue, off, remove } = await import("firebase/database");
      const { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } = await import("firebase/firestore");

      const myUid = (user as { uid: string }).uid;

      await updateDoc(doc(db, "users", myUid), {
        isOnline: true,
        lastSeen: serverTimestamp(),
        lookingForPartner: true,
      });

const myRef = push(ref(rtdb, "waiting"));
      const myRefKey = myRef.key;
      await set(myRef, {
        uid: myUid,
        nickname: userData?.nickname || "Anonymous",
        premium: userData?.premium || false,
        verified: userData?.verified || false,
        timestamp: Date.now(),
      });

      const callCleanupRef = ref(rtdb, `incoming/${myUid}`);
      
      onValue(callCleanupRef, async (snapshot) => {
        const data = snapshot.val();
        if (data && data.callerUid && data.callOffer) {
          console.log("=== INCOMING CALL DETECTED ===");
          
          const partner: ChatPartner = {
            uid: data.callerUid,
            nickname: data.callerNickname || "Anonymous",
            premium: data.callerPremium || false,
            verified: data.callerVerified || false,
          };
          
          await remove(callCleanupRef);
          await updateDoc(doc(db, "users", myUid), { lookingForPartner: false });
          
          if (searchInterval) clearInterval(searchInterval);
          setTimeout(() => {
            if (myRefKey) remove(ref(rtdb, `waiting/${myRefKey}`)).catch(() => {});
          }, 100);
          
          await setupCall(partner, stream, false);
          return;
        }
      }, { onlyOnce: false });

      await new Promise(resolve => setTimeout(resolve, 1000));

      let searchInterval: NodeJS.Timeout | null = null;
      
      const searchForPartner = async () => {
        try {
          console.log("=== SEARCHING ===");
          const q = query(
            collection(db, "users"),
            where("lookingForPartner", "==", true)
          );
          
          const snapshot = await getDocs(q);
          console.log("Users found:", snapshot.size);
          
          for (const docSnap of snapshot.docs) {
            if (docSnap.id !== myUid) {
              console.log("Found partner:", docSnap.id);
              const partnerData = docSnap.data();
              console.log("Partner data:", partnerData);
              
              const partner: ChatPartner = {
                uid: docSnap.id,
                nickname: partnerData.nickname || "Anonymous",
                premium: partnerData.premium || false,
                verified: partnerData.verified || false,
              };
              
              const incomingRef = ref(rtdb, `incoming/${partner.uid}`);
              await set(incomingRef, {
                callerUid: myUid,
                callerNickname: userData?.nickname || "Anonymous",
                callerPremium: userData?.premium || false,
                callerVerified: userData?.verified || false,
                timestamp: Date.now(),
              });
              
              await updateDoc(doc(db, "users", myUid), { lookingForPartner: false });
              
              if (searchInterval) clearInterval(searchInterval);
              setTimeout(() => {
                if (myRefKey) remove(ref(rtdb, `waiting/${myRefKey}`)).catch(() => {});
              }, 100);
              
              await setupCall(partner, stream, true);
              return;
            }
          }
          
          console.log("No partners found");
        } catch (e) {
          console.error("Search error:", e);
        }
      };

      console.log("Starting search...");
      await searchForPartner();
      
      searchInterval = setInterval(async () => {
        if (callState.status === "searching") {
          await searchForPartner();
        } else if (searchInterval) {
          clearInterval(searchInterval);
        }
      }, 2000);

      setTimeout(() => {
        if (searchInterval) clearInterval(searchInterval);
        if (callState.status === "searching") {
          setError(t("noFreeUsers"));
          setCallState({ status: "idle", partner: null });
          stopLocalStream();
          if (myRefKey) {
            remove(ref(rtdb, `waiting/${myRefKey}`)).catch(() => {});
          }
          remove(ref(rtdb, `incoming/${myUid}`)).catch(() => {});
        }
      }, 30000);

    } catch (err) {
      console.error("Error finding partner:", err);
      setError(t("searchError"));
      setCallState({ status: "idle", partner: null });
      stopLocalStream();
    }
  };

  const setupCallDirect = async (stream: MediaStream) => {
    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { rtdb, db } = getFirebase();
      
      if (!rtdb || !db || !user) {
        setError("Firebase не ініціалізований");
        setCallState({ status: "idle", partner: null });
        stopLocalStream();
        return;
      }

      const { ref, push, set, onValue, off } = await import("firebase/database");
      const { collection, query, where, getDocs, doc, updateDoc, serverTimestamp: fsTimestamp } = await import("firebase/firestore");

      const q = query(
        collection(db, "users"),
        where("isOnline", "==", true),
        where("lookingForPartner", "==", true)
      );
      
      const snapshot = await getDocs(q);
      let partner: ChatPartner | null = null;
      
      snapshot.forEach((docSnap) => {
        if (docSnap.id !== (user as { uid: string }).uid && !partner) {
          const data = docSnap.data();
          partner = {
            uid: docSnap.id,
            nickname: data.nickname,
            premium: data.premium || false,
            verified: data.verified || false,
          };
        }
      });

      if (partner) {
        await updateDoc(doc(db, "users", (user as { uid: string }).uid), { lookingForPartner: false });
        await setupCall(partner, stream);
      } else {
        setError(t("noFreeUsers"));
        setCallState({ status: "idle", partner: null });
        stopLocalStream();
      }
    } catch (err) {
      console.error("Error in setupCallDirect:", err);
      setError("Помилка з'єднання");
      setCallState({ status: "idle", partner: null });
      stopLocalStream();
    }
  };

  const setupCall = async (partner: ChatPartner, stream: MediaStream, isInitiator: boolean = true) => {
    console.log("=== SETUP CALL START ===");
    console.log("Partner:", partner.nickname, partner.uid);
    console.log("I am initiator:", isInitiator);
    
    try {
      const { getFirebase } = await import("@/lib/firebase");
      const { rtdb } = getFirebase();
      const { db } = getFirebase();
      
      if (!rtdb || !db || !user) {
        setError("Firebase не ініціалізований");
        setCallState({ status: "idle", partner: null });
        stopLocalStream();
        return;
      }

      const { ref, set, onValue, off, push, remove } = await import("firebase/database");
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      
      const myUid = (user as { uid: string }).uid;
      const callId = `${myUid}_${partner.uid}`;
      const partnerCallId = `${partner.uid}_${myUid}`;
      console.log("My UID:", myUid, "Call ID:", callId);
      
      console.log("Creating RTCPeerConnection...");
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      });

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peerConnection.iceConnectionState);
      };

      peerConnection.onconnectionstatechange = () => {
        console.log("Connection State:", peerConnection.connectionState);
      };

      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        const [remoteStreamObj] = event.streams;
        setRemoteStream(remoteStreamObj);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamObj;
        }
      };

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          const candidatesPath = isInitiator ? `calls/${callId}/candidates` : `calls/${partnerCallId}/candidates`;
          await push(ref(rtdb, candidatesPath), { candidate: event.candidate.toJSON() });
        }
      };

      setCallState({ status: "connecting", partner });
      console.log("=== CALL STATE: CONNECTING ===");

      if (isInitiator) {
        const existingCallRef = ref(rtdb, `calls/${partnerCallId}`);
        
        onValue(existingCallRef, async (snapshot) => {
          const data = snapshot.val();
          if (data && data.answer && peerConnection.signalingState === "have-local-offer") {
            console.log("=== GOT ANSWER ===");
            try {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
              console.log("Remote description set from answer!");
            } catch(e) { console.error("Error setting remote:", e); }
          }
        }, { onlyOnce: false });

        const listenersRef = ref(rtdb, `calls/${partnerCallId}/listeners`);
        await push(listenersRef, { uid: myUid, timestamp: Date.now() });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        console.log("Local description set, sending offer...");

        await set(ref(rtdb, `calls/${callId}`), {
          offer: peerConnection.localDescription,
          from: myUid,
          to: partner.uid,
          timestamp: Date.now(),
        });
        
        console.log("Offer sent! Waiting for answer...");
        
        setTimeout(async () => {
          listenerCleanup(callId, rtdb, ref, set, remove, myUid);
          listenerCleanup(partnerCallId, rtdb, ref, set, remove, myUid);
        }, 15000);

      } else {
        const incomingCallRef = ref(rtdb, `calls/${callId}`);
        
        onValue(incomingCallRef, async (snapshot) => {
          console.log("=== GOT OFFER ===");
          const data = snapshot.val();
          
          if (data && data.offer && !peerConnection.currentRemoteDescription) {
            console.log("Setting remote description from offer...");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            console.log("Creating answer...");
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            console.log("Sending answer...");
            await set(ref(rtdb, `calls/${callId}/answer`), {
              answer: peerConnection.localDescription,
              from: myUid,
              timestamp: Date.now(),
            });
            
            console.log("Answer sent!");
            
            const candidatesRef = ref(rtdb, `calls/${callId}/candidates`);
            onValue(candidatesRef, async (candSnap) => {
              const candData = candSnap.val();
              if (candData) {
                for (const [, cand] of Object.entries(candData)) {
                  try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate((cand as { candidate: RTCIceCandidateInit }).candidate));
                  } catch (e) { console.error("ICE error:", e); }
                }
              }
            }, { onlyOnce: false });
            
            setCallState({ status: "connected", partner });
            console.log("=== CONNECTED (ANSWERER) ===");
            setCallDuration(0);
            callTimerRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 60000);
            off(incomingCallRef);
          }
        }, { onlyOnce: false });
      }

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          console.log("=== PEER CONNECTION CONNECTED ===");
          if (callState.status !== "connected") {
            setCallState({ status: "connected", partner });
            setCallDuration(0);
            callTimerRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 60000);
          }
        }
        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "closed") {
          console.log("=== CALL ENDED ===");
          endCall();
        }
      };

    } catch (err) {
      console.error("Error setting up call:", err);
      setError(t("connectionError") + ": " + err);
      setCallState({ status: "idle", partner: null });
      stopLocalStream();
    }
  };

  const listenerCleanup = async (callPath: string, rtdb: any, ref: any, set: any, remove: any, myUid: string) => {
    try {
      await remove(ref(rtdb, `calls/${callPath}`)).catch(() => {});
    } catch(e) {}
  };

  const endCall = async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (callDuration >= 5) {
      const coinsEarned = 5;
      const eggsEarned = 1;
      
      await addCoins(coinsEarned);
      await addEggs(eggsEarned);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    stopLocalStream();
    setRemoteStream(null);
    setCallState({ status: "idle", partner: null });

    if (user) {
      const myUid = (user as { uid: string }).uid;
      try {
        const { getFirebase } = await import("@/lib/firebase");
        const { db, rtdb } = getFirebase();
        
        if (db) {
          const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
          const { ref, remove } = await import("firebase/database");
          await updateDoc(doc(db, "users", myUid), {
            lookingForPartner: false,
            lastSeen: serverTimestamp(),
          });
          if (rtdb) {
            remove(ref(rtdb, `waiting/${myUid}`)).catch(() => {});
            remove(ref(rtdb, `incoming/${myUid}`)).catch(() => {});
          }
        }
      } catch (e) {
        console.error("Error updating user status:", e);
      }
    }
  };

  const handleSignOut = async () => {
    await endCall();
    await signOut();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return null;
  }

  const getNameColor = () => {
    const nameColor = (userData as unknown as { nameColor?: string | null }).nameColor;
    if (nameColor === 'rainbow') return 'rainbow';
    if (nameColor) return nameColor;
    return '#f8fafc';
  };
  
  const nameColor = getNameColor();

  return (
    <div className="container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "12px" }}>
      <audio ref={localAudioRef} autoPlay muted playsInline style={{ display: "none" }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      <header style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="flex items-center gap-2">
          <div className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
            {userData.nickname[0]}
          </div>
<div>
            <div style={{ 
              fontWeight: 600, 
              fontSize: 14,
              color: nameColor === 'rainbow' ? 'transparent' : nameColor,
              background: nameColor === 'rainbow' ? 
                'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00ff, #ff0000)' : undefined,
              backgroundClip: nameColor === 'rainbow' ? 'text' : undefined,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: nameColor === 'rainbow' ? 'transparent' : undefined,
            }}>{userData.nickname}</div>
            <div className="flex items-center gap-4" style={{ marginTop: 4 }}>
              {userData.premium && <span className="badge badge-premium">⭐</span>}
              {userData.verified && <span className="badge">✓</span>}
              {userData.inventory.includes('vip_badge') && <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>👑</span>}
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <span className="status-dot"></span>
              {t("online")}
              <select 
                value={language} 
                onChange={(e) => changeLanguage(e.target.value as Language)}
                style={{ marginLeft: 8, background: '#1a1a2e', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}
              >
                {Object.keys(translations).map((lang) => (
                  <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userData.nickname === 'prostosparky' && (
            <button onClick={() => router.push("/admin")} className="btn btn-secondary" style={{ padding: "8px", fontSize: "16px" }} title={t("admin")}>
              ⚙️
            </button>
          )}
          <button onClick={() => router.push("/settings")} className="btn btn-secondary" style={{ padding: "8px", fontSize: "16px" }} title={t("settings")}>
            🎨
          </button>
          <button onClick={() => router.push("/shop")} className="btn btn-secondary" style={{ padding: "8px", fontSize: "16px" }} title={t("shop")}>
            🛒
          </button>
<button onClick={handleSignOut} className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "13px" }}>
              {t("exit")}
            </button>
        </div>
      </header>

      <div className="balance-display" style={{ padding: "8px 0" }}>
        <div className="currency currency-coins">
          <span className="coin-icon">🪙</span>
          <span>{userData.coins ?? 0}</span>
        </div>
        <div className="currency currency-eggs">
          <span className="egg-icon">🥚</span>
          <span>{userData.eggs ?? 0}</span>
        </div>
      </div>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "8px 0" }}>
        {callState.status === "idle" && (
          <div className="card text-center" style={{ maxWidth: 360, width: "100%", padding: "24px 16px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎙️</div>
            <h2 className="title">VoiceChat</h2>
            <p className="subtitle">{t("findNewFriend")}</p>
            
            {error && <p className="error">{error}</p>}
            
            <button onClick={findPartner} className="btn btn-primary btn-lg w-full mt-4">
              {t("findPartner")}
            </button>
          </div>
        )}

        {callState.status === "searching" && (
          <div className="card text-center" style={{ maxWidth: 360, width: "100%", padding: "24px 16px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              <span className="spinner" style={{ width: 48, height: 48 }}></span>
            </div>
            <h2 className="title">{t("searching")}</h2>
            <p className="subtitle">{t("searchingFor")}</p>
            <button onClick={() => { endCall(); }} className="btn btn-secondary mt-4">
              {t("cancel")}
            </button>
          </div>
        )}

        {callState.status === "connecting" && (
          <div className="card text-center" style={{ maxWidth: 360, width: "100%", padding: "24px 16px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              <span className="spinner" style={{ width: 48, height: 48 }}></span>
            </div>
            <h2 className="title">{t("connecting")}</h2>
            <p className="subtitle">{t("connectingTo")} {callState.partner?.nickname}</p>
          </div>
        )}

        {callState.status === "connected" && callState.partner && (
          <div className="card text-center" style={{ maxWidth: 360, width: "100%", padding: "24px 16px" }}>
            <div className="avatar" style={{ margin: "0 auto 16px", width: 72, height: 72, fontSize: 24 }}>
              {callState.partner.nickname[0]}
            </div>
            
            <h2 className="title">
              {callState.partner.nickname}
              {callState.partner.premium && <span className="badge badge-premium">⭐</span>}
              {callState.partner.verified && <span className="badge">✓</span>}
            </h2>
            
            <p className="subtitle" style={{ marginBottom: 20 }}>
              <span className="status-dot" style={{ marginRight: 6 }}></span>
              {t("connected")} • {callDuration} {t("minutes")}
            </p>

            <div className="flex justify-center gap-4 mb-4">
              <button 
                onClick={toggleMute} 
                className={`btn btn-icon ${isMuted ? "btn-danger" : "btn-secondary"}`}
                title={isMuted ? t("unmute") : t("mute")}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>
              
              <button onClick={endCall} className="btn btn-danger btn-icon" title={t("endCall")}>
                📞
              </button>
            </div>

            <button onClick={() => { endCall(); findPartner(); }} className="btn btn-secondary w-full">
              {t("next")}
            </button>
          </div>
        )}
      </main>

      <footer style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
        VoiceChat © 2026
      </footer>
    </div>
  );
}
