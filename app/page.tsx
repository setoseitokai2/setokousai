// app/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
// ★QRリーダーのインポート
import { QrReader } from 'react-qr-reader';

// 型定義
type Ticket = {
  uniqueKey: string;
  shopId: string;
  shopName: string;
  shopDepartment?: string;
  time: string;
  timestamp: number;
  status: "reserved" | "waiting" | "ready" | "used" | "done";
  count: number;
  isQueue?: boolean;
  ticketId?: string;
  peopleAhead?: number;
};

// ★「ピッ」1回の長さ（秒）と、2回目の「ピッ」が鳴り始めるまでのオフセット（秒）
const TONE_DURATION = 0.15;
const SECOND_TONE_OFFSET = 0.2;
// ★「ピッピ」全体の長さ（ミリ秒）＝2回目のオフセット + 1回分の長さ
const BEEP_TOTAL_MS = (SECOND_TONE_OFFSET + TONE_DURATION) * 1000;
// ★「ピッピ」が鳴り終わってから次の「ピッピ」までの間隔（ミリ秒）
const GAP_AFTER_BEEP_MS = 1000;

export default function Home() {
  const [attractions, setAttractions] = useState<any[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [selectedShop, setSelectedShop] = useState<any | null>(null);
  const [userId, setUserId] = useState("");
  const [isBanned, setIsBanned] = useState(false);

  // ★通知設定（デフォルトOFF）
  const [enableSound, setEnableSound] = useState(false);
  const [enableVibrate, setEnableVibrate] = useState(false);

  // ★個別チケットごとの音声停止管理（uniqueKeyのSet）
  const [mutedTickets, setMutedTickets] = useState<Set<string>>(new Set());

  // ★QRコード関連のステート
  // qrTicket がセットされているときだけカメラモーダルを開く
  const [qrTicket, setQrTicket] = useState<Ticket | null>(null);

  // 音声再生用の参照 (Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);
  // ★「ピッピ→1秒あける」ループの再スケジュール用タイマー参照
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 申し込み画面用の状態
  const [draftBooking, setDraftBooking] = useState<{ time: string; remaining: number; mode: "slot" | "queue"; maxPeople: number } | null>(null);
  const [peopleCount, setPeopleCount] = useState<number>(1);
  // ★満席で予約に失敗したかどうかのフラグ
  const [bookingFailed, setBookingFailed] = useState(false);

  // ★現在時刻のステート（解放判定＆時計表示用）
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // ★現在時刻を1秒ごとに更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ★単発の短いビープ音を指定した時刻(startTime)に鳴らすヘルパー
  const playSingleTone = (ctx: AudioContext, startTime: number) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    // ★周波数は880Hzで固定（ピッチを下げる処理は削除）
    oscillator.frequency.setValueAtTime(880, startTime);

    gainNode.gain.setValueAtTime(0.5, startTime);
    // 短い減衰（約0.12秒）で「ピッ」という短音にする
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + TONE_DURATION);
  };

  // ★「ピピッ」という2連ビープを鳴らす関数
  const playBeep = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }

        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;

        // 1回目の「ピッ」
        playSingleTone(ctx, now);
        // 2回目の「ピッ」（0.2秒後、合計で「ピピッ」というリズムに）
        playSingleTone(ctx, now + SECOND_TONE_OFFSET);
    } catch (e) {
        console.error("Audio play failed", e);
    }
  };

  // ★音量テストボタン用（強制的に鳴らす）
  const handleTestSound = () => {
     playBeep();
     if (typeof navigator !== "undefined" && navigator.vibrate) {
         navigator.vibrate(200);
     }
     alert("テスト音再生中\n(マナーモードや音量設定を確認してください)");
  };

  // ★個別チケットの音声停止/再開を切り替える
  const toggleMuteTicket = (uniqueKey: string) => {
    setMutedTickets(prev => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) {
        next.delete(uniqueKey);
      } else {
        next.add(uniqueKey);
      }
      return next;
    });
  };

  // 1. 初期化とデータ監視
  useEffect(() => {
    signInAnonymously(auth).catch((e) => console.error(e));
    
    let storedId = localStorage.getItem("bunkasai_user_id");
    if (!storedId) {
      // 0〜999999までの数値を生成し、6桁になるよう先頭を0で埋める
      storedId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      localStorage.setItem("bunkasai_user_id", storedId);
    }
    setUserId(storedId);

    const userDocRef = doc(db, "users", storedId);
    getDoc(userDocRef).then((snap) => {
        if (!snap.exists()) {
            setDoc(userDocRef, {
                userId: storedId,
                createdAt: serverTimestamp(),
                isBanned: false        
            }).catch(err => console.error("User regist error:", err));
        }
    });
    const unsubUser = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) setIsBanned(snap.data().isBanned === true);
    });

    const unsubAttractions = onSnapshot(collection(db, "attractions"), (snapshot) => {
      const shopData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttractions(shopData);

      const newMyTickets: Ticket[] = [];
      
      shopData.forEach((shop: any) => {
        if (shop.reservations) {
          shop.reservations.forEach((r: any) => {
            if (r.userId === storedId) {
              newMyTickets.push({
                uniqueKey: `slot_${shop.id}_${r.time}`,
                shopId: shop.id,
                shopName: shop.name,
                shopDepartment: shop.department,
                time: r.time,
                timestamp: r.timestamp,
                status: r.status,
                count: r.count || 1,
                isQueue: false
              });
            }
          });
        }

        if (shop.queue) {
          shop.queue.forEach((q: any) => {
            if (q.userId === storedId) {
              let groupsAhead = 0;
              if (q.status === 'waiting') {
                const myNum = parseInt(q.ticketId || "999999");
                groupsAhead = shop.queue.filter((other: any) => 
                  other.status === 'waiting' && parseInt(other.ticketId || "999999") < myNum
                ).length;
              }

              newMyTickets.push({
                uniqueKey: `queue_${shop.id}_${q.ticketId}`,
                shopId: shop.id,
                shopName: shop.name,
                shopDepartment: shop.department,
                time: "順番待ち",
                timestamp: q.createdAt?.toMillis() || Date.now(),
                status: q.status,
                count: q.count || 1,
                isQueue: true,
                ticketId: q.ticketId,
                peopleAhead: groupsAhead
              });
            }
          });
        }
      });

      newMyTickets.sort((a, b) => {
        if (a.status === 'ready' && b.status !== 'ready') return -1;
        if (a.status !== 'ready' && b.status === 'ready') return 1;
        return b.timestamp - a.timestamp;
      });

      setMyTickets(newMyTickets);
    });

    return () => {
        unsubUser();        
        unsubAttractions(); 
    };
  }, []);

  const activeTickets = myTickets.filter(t => ["reserved", "waiting", "ready"].includes(t.status));

  // ★通知ループ処理
  // ・「ピッピ」を鳴らす → 鳴り終わってから正確に1秒あける → また「ピッピ」…を繰り返す（setTimeoutの再帰呼び出し）
  // ・status が 'ready'（チケットが赤くなった状態）かつ「音声停止」されていないチケットが
  //   1つでもあればループが有効
  // ・入場処理でチケットが activeTickets から消える（＝消費される）と自動的に鳴り止む
  useEffect(() => {
    const hasUnmutedReadyTicket = activeTickets.some(
      t => t.status === 'ready' && !mutedTickets.has(t.uniqueKey)
    );

    const shouldRun = hasUnmutedReadyTicket && (enableSound || enableVibrate);

    if (shouldRun) {
      const loop = () => {
        if (enableSound) playBeep();
        if (enableVibrate && typeof navigator !== "undefined" && navigator.vibrate) {
            try { navigator.vibrate(200); } catch(e) { /* ignore */ }
        }
        // ★「ピッピ」の再生（約0.35秒）が終わってから、正確に1秒後に次を鳴らす
        loopTimeoutRef.current = setTimeout(loop, BEEP_TOTAL_MS + GAP_AFTER_BEEP_MS);
      };
      // まだループが動いていなければ開始する（重複起動を防止）
      if (!loopTimeoutRef.current) {
        loop();
      }
    } else {
      // 条件を満たさなくなったらループを止める
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    }

    return () => {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
  }, [activeTickets, enableSound, enableVibrate, mutedTickets]);


  if (isBanned) {
      return (
          <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-4 text-center">
              <h1 className="text-3xl font-bold mb-2">ACCESS DENIED</h1>
              <p>利用停止処分が適用されています</p>
          </div>
      );
  }

  // --- 予約・発券ロジック ---

  const handleSelectTime = (shop: any, time: string) => {
    if (activeTickets.length >= 3) return alert("チケットは3枚までです。");
    if (activeTickets.some(t => t.shopId === shop.id && t.time === time)) return alert("既に予約済みです。");
    
    const limitGroups = shop.capacity || 0; 
    const current = shop.slots[time] || 0;
    const remaining = limitGroups - current;

    if (remaining <= 0) return alert("満席です。");
    if (shop.isPaused) return alert("停止中です。");
    
    const maxPeople = shop.groupLimit || 10;

    setPeopleCount(1);
    setBookingFailed(false);
    setDraftBooking({ time, remaining, mode: "slot", maxPeople });
  };

  const handleJoinQueue = (shop: any) => {
    if (activeTickets.length >= 3) return alert("チケットは3枚までです。");
    if (activeTickets.some(t => t.shopId === shop.id)) return alert("既にこの店に並んでいます。");
    if (shop.isPaused) return alert("停止中です。");

    const maxPeople = shop.groupLimit || 10;

    setPeopleCount(1);
    setBookingFailed(false);
    setDraftBooking({ time: "順番待ち", remaining: 999, mode: "queue", maxPeople });
  };

  const handleConfirmBooking = async () => {
    if (!selectedShop || !draftBooking) return;

    if (!confirm(`${selectedShop.name}\n${draftBooking.mode === "queue" ? "並びますか？" : "予約しますか？"}\n人数: ${peopleCount}名`)) return;

    try {
      const shopRef = doc(db, "attractions", selectedShop.id);
      
      if (draftBooking.mode === "slot") {
        // ★予約確定の直前に最新の空き状況を再確認（枠が埋まっていないかチェック）
        const latestSnap = await getDoc(shopRef);
        const latestData = latestSnap.data();
        const currentCount = latestData?.slots?.[draftBooking.time] || 0;
        const limitGroups = latestData?.capacity || 0;

        if (currentCount >= limitGroups) {
          // 満席になっていた場合は予約せずにエラー表示に切り替える
          setBookingFailed(true);
          return;
        }

        const timestamp = Date.now();
        const reservationData = { userId, time: draftBooking.time, timestamp, status: "reserved", count: peopleCount };
        await updateDoc(shopRef, { 
            [`slots.${draftBooking.time}`]: increment(1),
            reservations: arrayUnion(reservationData)
        });
      } else {
        const shopSnap = await getDoc(shopRef);
        const currentQueue = shopSnap.data()?.queue || [];
        let maxId = 0;
        currentQueue.forEach((q: any) => {
            const num = parseInt(q.ticketId || "0");
            if (num > maxId) maxId = num;
        });
        const nextIdNum = maxId + 1;
        const nextTicketId = String(nextIdNum).padStart(6, '0');

        const queueData = {
          userId,
          ticketId: nextTicketId,
          count: peopleCount,
          status: "waiting",
          createdAt: Timestamp.now()
        };

        await updateDoc(shopRef, {
          queue: arrayUnion(queueData)
        });

        alert(`発券しました！\n番号: ${nextTicketId}`);
      }
      setDraftBooking(null);
      setSelectedShop(null);
      setBookingFailed(false);
    } catch (e) { 
      console.error(e);
      alert("エラーが発生しました。もう一度お試しください。"); 
    }
  };

  const handleCancel = async (ticket: Ticket) => {
    if (!confirm("キャンセルしますか？")) return;
    try {
      const shopRef = doc(db, "attractions", ticket.shopId);
      const shopSnap = await getDoc(shopRef);
      if (!shopSnap.exists()) return;
      const shopData = shopSnap.data();

      if (ticket.isQueue) {
         const targetQ = shopData.queue?.find((q: any) => q.ticketId === ticket.ticketId);
         if (targetQ) {
           await updateDoc(shopRef, { queue: arrayRemove(targetQ) });
         }
      } else {
         const targetRes = shopData.reservations?.find((r: any) => r.userId === userId && r.time === ticket.time && r.timestamp === ticket.timestamp);
         if (targetRes) {
           await updateDoc(shopRef, { 
             [`slots.${ticket.time}`]: increment(-1),
             reservations: arrayRemove(targetRes)
           });
         }
      }
      alert("キャンセルしました");
    } catch (e) { alert("キャンセル失敗"); }
  };

  // --- ★入場ロジック (共通処理) ---
  const processEntry = async (ticket: Ticket, inputPass: string) => {
    const shop = attractions.find(s => s.id === ticket.shopId);
    if (!shop) return;
    
    // パスワード照合
    if (inputPass !== shop.password) {
        alert("パスワードが違います（QRコードが異なる可能性があります）");
        return;
    }

    try {
      const shopRef = doc(db, "attractions", shop.id);
      
      if (ticket.isQueue) {
        // 整理券の場合の入場処理
        const targetQ = shop.queue.find((q: any) => q.ticketId === ticket.ticketId);
        if(targetQ) await updateDoc(shopRef, { queue: arrayRemove(targetQ) });
      } else {
        // 時間指定予約の場合の入場処理
        const oldRes = shop.reservations.find((r: any) => r.userId === userId && r.time === ticket.time && r.status === "reserved");
        if(oldRes) {
            await updateDoc(shopRef, { reservations: arrayRemove(oldRes) });
            await updateDoc(shopRef, { reservations: arrayUnion({ ...oldRes, status: "used" }) });
        }
      }
      
      alert(`「${shop.name}」に入場しました！`);
      setQrTicket(null); // QRカメラを閉じる
    } catch(e) {
      console.error(e);
      alert("エラーが発生しました。");
    }
  };

  // ★手動入力での入場
  const handleManualEnter = (ticket: Ticket) => {
    const shop = attractions.find(s => s.id === ticket.shopId);
    if (!shop) return;
    if (ticket.isQueue && ticket.status !== 'ready') return alert("まだ呼び出しされていません。");

    const inputPass = prompt(`${shop.name}のスタッフパスワードを入力：`);
    if (inputPass === null) return; // キャンセル時
    processEntry(ticket, inputPass);
  };

  // ★QRスキャン完了時の処理
  const handleQrScan = (result: any) => {
    if (result && qrTicket) {
        const scannedPassword = result?.text || result;
        processEntry(qrTicket, scannedPassword);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen pb-20 relative">
      <header className="mb-6">
        <div className="flex justify-between items-center mb-2">
           <div className="flex items-center gap-2">
               <h1 className="text-xl font-bold text-blue-900">予約・整理券</h1>
           </div>
           
           <div className="flex items-center gap-2">
               <div className={`px-3 py-1 rounded-full text-sm font-bold ${activeTickets.length >= 3 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                   {activeTickets.length}/3枚
               </div>
           </div>
        </div>
        
        <div className="bg-gray-800 text-white text-center py-1 rounded text-xs font-mono mb-2">
            User ID: {userId}
        </div>

        {/* 通知設定パネル */}
        <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 pl-2">呼び出し通知</span>
            <div className="flex gap-2">
                <button 
                  onClick={() => setEnableSound(!enableSound)}
                  className={`px-2 py-1.5 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${enableSound ? "bg-blue-500 text-white border-blue-600" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                >
                  {enableSound ? "🔊 音ON" : "🔇 音OFF"}
                </button>
                <button 
                  onClick={() => setEnableVibrate(!enableVibrate)}
                  className={`px-2 py-1.5 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${enableVibrate ? "bg-blue-500 text-white border-blue-600" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                >
                  {enableVibrate ? "📳 振動ON" : "📴 振動OFF"}
                </button>
                <button 
                  onClick={handleTestSound} 
                  className="px-2 py-1.5 rounded text-xs border bg-gray-200 text-gray-600 active:bg-gray-300"
                >
                  🔔 テスト
                </button>
            </div>
        </div>
      </header>

      {/* チケット一覧 */}
      {activeTickets.length > 0 && (
        <div className="mb-8 space-y-4">
          <p className="text-blue-900 text-sm font-bold">🎟️ あなたのチケット</p>
          {activeTickets.map((t) => {
            const isReady = t.status === 'ready';
            const isMuted = mutedTickets.has(t.uniqueKey);
            const cardClass = isReady 
              ? "bg-red-50 border-l-4 border-red-500 shadow-xl ring-2 ring-red-400 animate-pulse-slow" 
              : "bg-white border-l-4 border-green-500 shadow-lg";

            return (
              <div key={t.uniqueKey} className={`${cardClass} p-4 rounded relative`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                      {t.shopDepartment && (
                        <p className="text-xs font-bold text-gray-500 mb-0.5">{t.shopDepartment}</p>
                      )}
                      <h2 className="font-bold text-lg flex items-center gap-2 leading-tight">
                          {t.shopName}
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap">
                             {t.count}名
                          </span>
                      </h2>
                      
                      {t.isQueue ? (
                        <div className="mt-2 p-2 bg-gray-100 rounded border border-gray-200 inline-block">
                          <p className="text-xs text-gray-500 font-bold mb-1">整理券番号</p>
                          <p className="text-3xl font-mono font-black text-gray-800 tracking-widest leading-none">
                              {t.ticketId}
                          </p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-blue-600 font-mono mt-1">{t.time}</p>
                      )}
                      
                      {t.isQueue && (
                          <div className="mt-2">
                              {isReady ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-red-600 font-bold text-lg animate-bounce">🔔 呼び出し中です！</p>
                                  {/* ★音声停止/再開ボタン */}
                                  <button
                                    onClick={() => toggleMuteTicket(t.uniqueKey)}
                                    className={`text-xs font-bold px-2 py-1 rounded-full border transition-colors
                                      ${isMuted 
                                        ? "bg-gray-100 text-gray-500 border-gray-300" 
                                        : "bg-white text-red-600 border-red-300 hover:bg-red-50"}`}
                                  >
                                    {isMuted ? "🔔 音声再開" : "🔕 音声停止"}
                                  </button>
                                </div>
                              ) : (
                                <p className="text-blue-600 font-bold text-sm">
                                  あなたの前に <span className="text-xl text-blue-800">{t.peopleAhead}</span> 組待ち
                                </p>
                              )}
                          </div>
                      )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {/* 手動入力ボタン */}
                    <button 
                        onClick={() => handleManualEnter(t)} 
                        disabled={t.isQueue && !isReady} 
                        className={`flex-1 font-bold py-3 rounded-lg shadow transition text-sm
                        ${(t.isQueue && !isReady) 
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                            : "bg-blue-600 text-white hover:bg-blue-500"
                        }`}
                    >
                        {t.isQueue && !isReady ? "待機中..." : "パスワード入力で入場"}
                    </button>
                    {/* キャンセルボタン */}
                    <button onClick={() => handleCancel(t)} className="px-4 text-red-500 border border-red-200 rounded-lg text-xs hover:bg-red-50">
                        削除
                    </button>
                  </div>

                  {/* ★QRコードで入場ボタン */}
                  <button 
                    onClick={() => setQrTicket(t)}
                    disabled={t.isQueue && !isReady}
                    className={`w-full font-bold py-3 rounded-lg border-2 flex items-center justify-center gap-2 transition
                        ${(t.isQueue && !isReady)
                            ? "border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50"
                            : "border-black text-black bg-white hover:bg-gray-100"
                        }`}
                  >
                     <span>📷</span> QRコードで入場
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 店舗選択リスト */}
      {!selectedShop ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-600 mb-2 border-b pb-2">アトラクションを選ぶ</p>
          {attractions.map((shop) => (
            <button key={shop.id} onClick={() => setSelectedShop(shop)} className={`w-full bg-white p-3 rounded-xl shadow-sm border text-left flex items-start gap-3 hover:bg-gray-50 transition ${shop.isPaused ? 'opacity-60 grayscale' : ''}`}>
              {shop.imageUrl && (
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={shop.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
              )}
              <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 mb-1">
                      {shop.isQueueMode && <span className="bg-orange-100 text-orange-700 border-orange-200 border text-[10px] px-2 py-0.5 rounded font-bold">順番待ち制</span>}
                      {shop.isPaused && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded">受付停止中</span>}
                  </div>
                  {shop.department && (
                    <p className="text-xs text-blue-600 font-bold mb-0.5">{shop.department}</p>
                  )}
                  <h3 className="font-bold text-lg leading-tight truncate text-gray-800 mb-1">{shop.name}</h3>
                  <div className="text-xs text-gray-400">
                      {shop.isQueueMode 
                        ? `待ち: ${shop.queue?.filter((q:any)=>q.status==='waiting').length || 0}組` 
                        : `予約可`}
                  </div>
              </div>
              <div className="self-center text-gray-300">&gt;</div>
            </button>
          ))}
        </div>
      ) : (
        // 詳細・予約画面
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden pb-10">
            <div className="relative">
               {/* ★詳細ヘッダー：現在時刻の表示 */}
               <div className="bg-gray-900 text-white text-center py-2 text-lg font-mono tracking-widest flex items-center justify-center gap-2">
                   <span className="text-sm text-gray-300">現在時刻</span>
                   {currentTime.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
               </div>

               {/* 詳細ヘッダー画像 */}
               {selectedShop.imageUrl && (
                 <div className="w-full h-56 bg-gray-200">
                   <img 
                     src={selectedShop.imageUrl} 
                     alt={selectedShop.name} 
                     className="w-full h-full object-cover" 
                   />
                 </div>
               )}

               <button 
                 onClick={() => { setSelectedShop(null); setDraftBooking(null); setBookingFailed(false); }} 
                 className={`absolute ${selectedShop.imageUrl ? "top-14" : "top-3"} left-3 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md z-10 hover:bg-black/70 transition`}
               >
                 ← 戻る
               </button>

               <div className={`p-5 border-b bg-gray-50 ${!selectedShop.imageUrl ? "pt-16" : ""}`}>
                   {selectedShop.department && (
                     <p className="text-sm font-bold text-blue-600 mb-1">{selectedShop.department}</p>
                   )}
                   <h2 className="text-2xl font-bold leading-tight text-gray-900">{selectedShop.name}</h2>
               </div>
            </div>

            <div className="p-4">
                {selectedShop.description && (
                    <div className="mb-6 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {selectedShop.description}
                    </div>
                )}

                {selectedShop.isPaused ? (
                    <p className="text-red-500 font-bold mb-4 bg-red-100 p-3 rounded text-center">現在 受付停止中です</p>
                ) : (
                    <>
                        {selectedShop.isQueueMode ? (
                           <div className="text-center py-6">
                              <div className="mb-6">
                                <p className="text-gray-500 text-sm font-bold mb-2">現在の待ち状況</p>
                                <div className="flex justify-center gap-4">
                                   <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 min-w-[100px]">
                                      <p className="text-xs text-orange-600">待ち組数</p>
                                      <p className="text-3xl font-bold text-orange-900">
                                        {selectedShop.queue?.filter((q:any)=>q.status==='waiting').length || 0}
                                        <span className="text-sm font-normal ml-1">組</span>
                                      </p>
                                   </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleJoinQueue(selectedShop)}
                                className="w-full bg-orange-500 text-white text-xl font-bold py-4 rounded-xl shadow-lg hover:bg-orange-600 transition flex items-center justify-center gap-2"
                              >
                                <span>🏃</span> 整理券を発券する
                              </button>
                           </div>
                        ) : (
                           <div className="grid grid-cols-3 gap-3">
                              {Object.entries(selectedShop.slots || {}).sort().map(([time, count]: any) => {
                                 const limitGroups = selectedShop.capacity || 0; 
                                 const isFull = count >= limitGroups;
                                 const remaining = limitGroups - count;
                                 const isBooked = activeTickets.some(t => t.shopId === selectedShop.id && t.time === time);
                                 
                                 // ★解放判定ロジックの追加
                                 let isLocked = false;
                                 let releaseTimeStr = "";

                                 if (selectedShop.releaseBeforeTime && selectedShop.releaseBeforeTime !== "00:00") {
                                     // 予約枠の時間を本日の日付として設定
                                     const [slotHour, slotMinute] = time.split(':').map(Number);
                                     const slotDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), slotHour, slotMinute, 0, 0);
                                     
                                     // 設定時間（例:00:30）を逆算
                                     const [offsetHour, offsetMinute] = selectedShop.releaseBeforeTime.split(':').map(Number);
                                     const releaseDate = new Date(slotDate.getTime() - (offsetHour * 60 + offsetMinute) * 60000);

                                     if (currentTime < releaseDate) {
                                         isLocked = true;
                                         releaseTimeStr = `String(releaseDate.getHours()).padStart(2,'0'):{String(releaseDate.getMinutes()).padStart(2, '0')} 解放`;
                                     }
                                 }

                                 const isDisabled = isFull || isBooked || isLocked;
                                 
                                 return (
                                     <button 
                                       key={time} 
                                       disabled={isDisabled} 
                                       onClick={() => handleSelectTime(selectedShop, time)}
                                       className={`p-2 rounded border h-24 flex flex-col items-center justify-center transition-colors
                                         ${isBooked ? "bg-green-50 border-green-500" 
                                         : isLocked ? "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed" 
                                         : "bg-white border-blue-200 hover:bg-blue-50"}`}
                                     >
                                        <span className={`font-bold ${isLocked ? "text-gray-500" : ""}`}>{time}</span>
                                        <span className={`text-xs mt-1 ${isLocked ? "text-red-500 font-bold" : ""}`}>
                                           {isBooked ? "予約済" : isLocked ? releaseTimeStr : isFull ? "満席" : `あと${remaining}組`}
                                        </span>
                                     </button>
                                 );
                              })}
                           </div>
                        )}
                    </>
                )}
            </div>
        </div>
      )}
      
      {/* 申し込み確認モーダル */}
      {draftBooking && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
            <div className={`${draftBooking.mode === "queue" ? "bg-orange-500" : "bg-blue-600"} text-white p-4 text-center`}>
              <h3 className="text-lg font-bold">{draftBooking.mode === "queue" ? "整理券の発券" : "予約の確認"}</h3>
            </div>
            
            <div className="p-6">
              <p className="text-center text-sm font-bold text-gray-500 mb-1">{selectedShop.department}</p>
              <p className="text-center font-bold text-xl mb-4">{selectedShop.name}</p>
              
              {bookingFailed ? (
                // ★満席で予約できなかった場合のお詫びメッセージ
                <p className="text-center text-red-600 font-bold text-sm mb-6 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed">
                    満員になったため予約することができませんでした。申し訳ございません。
                </p>
              ) : (
                <>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                      人数を選択してください
                  </label>
                  <select 
                      value={peopleCount} 
                      onChange={(e) => setPeopleCount(Number(e.target.value))}
                      className="w-full text-lg p-3 border-2 border-gray-200 rounded-lg mb-6"
                  >
                      {[...Array(draftBooking.maxPeople)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1}名</option>
                      ))}
                  </select>
                </>
              )}

              <div className={`flex gap-3 ${bookingFailed ? "justify-center" : ""}`}>
                  <button 
                    onClick={() => { setDraftBooking(null); setBookingFailed(false); }} 
                    className={`${bookingFailed ? "w-1/2" : "flex-1"} py-3 bg-gray-100 rounded-lg font-bold text-gray-500`}
                  >
                    やめる
                  </button>
                  {!bookingFailed && (
                    <button onClick={handleConfirmBooking} className={`flex-1 py-3 text-white font-bold rounded-lg shadow ${draftBooking.mode === "queue" ? "bg-orange-500" : "bg-blue-600"}`}>
                        {draftBooking.mode === "queue" ? "発券する" : "予約する"}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ★QRコードリーダー モーダル */}
      {qrTicket && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-sm">
                  <h3 className="text-white font-bold text-center mb-4 text-lg">
                      QRコードを読み取ってください
                  </h3>
                  
                  <div className="relative rounded-xl overflow-hidden border-2 border-gray-700 bg-black">
                       <QrReader
                          onResult={handleQrScan}
                          constraints={{ facingMode: 'environment' }}
                          className="w-full"
                          scanDelay={500}
                       />
                       {/* 枠の演出 */}
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="w-64 h-64 border-4 border-green-500/50 rounded-lg"></div>
                       </div>
                  </div>

                  <p className="text-gray-400 text-xs text-center mt-4">
                      会場のQRコードを枠内に写してください
                  </p>
                  
                  <button 
                      onClick={() => setQrTicket(null)}
                      className="w-full mt-6 py-4 bg-gray-800 text-white font-bold rounded-lg border border-gray-600"
                  >
                      キャンセル
                  </button>
              </div>
          </div>
      )}

    </div>
  );
}


