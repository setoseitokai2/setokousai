// ＃ユーザー管理画面 (app/admin/super/Hack/page.tsx)
"use client";
import { useState, useEffect, useMemo } from "react";
// ↓ 環境に合わせてパスを調整してください (例: "@/firebase" or "../../../../firebase")
import { db, auth } from "../../../../firebase"; 
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

type Tab = "venues" | "users";

// ★修正ポイント1: 入力バグを防ぐための独立した入力コンポーネント
const NicknameInput = ({ userId, initialValue, onSave }: { userId: string, initialValue: string, onSave: (uid: string, val: string) => void }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue || "");
    }, [initialValue]);

    const handleBlur = () => {
        if (value !== initialValue) {
            onSave(userId, value);
        }
    };

    return (
        <input 
            className="bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none w-full text-white placeholder-gray-600 transition"
            placeholder="メモ・名前を入力..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
        />
    );
};

export default function AdminPage() {
  // --- 共通ステート ---
  const [activeTab, setActiveTab] = useState<Tab>("venues");
  const [myUserId, setMyUserId] = useState("");

  // --- データソース ---
  const [attractions, setAttractions] = useState<any[]>([]); 
  const [users, setUsers] = useState<any[]>([]); 

  // --- 1. 会場管理(Hack)用ステート ---
  const [targetStudentId, setTargetStudentId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentReservations, setStudentReservations] = useState<any[]>([]);
  
  // ★変更点: 強制予約入力用
  const [addShopId, setAddShopId] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addCount, setAddCount] = useState(1); // ★追加: 人数選択用

  const [showVenueConfig, setShowVenueConfig] = useState(false); 
  const [selectedConfigShopId, setSelectedConfigShopId] = useState<string | null>(null);
  const [configInputUserId, setConfigInputUserId] = useState("");
  const [showGuestWhite, setShowGuestWhite] = useState(false);
  const [showStudentWhite, setShowStudentWhite] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // --- 2. ユーザーDB管理用ステート ---
  const [dbSearchQuery, setDbSearchQuery] = useState(""); 

  // =================================================================
  //  初期化・データ監視
  // =================================================================
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);

    const initUser = async () => {
        let stored = localStorage.getItem("bunkasai_user_id");
        if (!stored) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let result = "";
            for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            stored = result;
            localStorage.setItem("bunkasai_user_id", stored);
        }
        setMyUserId(stored);

        const userRef = doc(db, "users", stored);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                userId: stored,
                createdAt: serverTimestamp(),
                nickname: "管理者", 
                isPinned: true,    
                isBanned: false,
            });
        }
    };
    initUser();

    const unsubAttractions = onSnapshot(collection(db, "attractions"), (snapshot) => {
      setAttractions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
        unsubAttractions();
        unsubUsers();
    };
  }, []);

  // 会場設定の連動ロジック
  useEffect(() => {
    if (selectedConfigShopId) {
        const shop = attractions.find(s => s.id === selectedConfigShopId);
        if (shop) {
            setShowGuestWhite(shop.guestListType === "white");
            setShowStudentWhite(shop.studentListType === "white");
        }
    }
  }, [selectedConfigShopId, attractions]);


  // =================================================================
  //  ヘルパー関数
  // =================================================================
    
  const getUserNickname = (uid: string) => {
      const u = users.find(user => user.id === uid);
      return u && u.nickname ? u.nickname : "";
  };

  // =================================================================
  //  機能群 1: ユーザーDB管理
  // =================================================================
    
  const handleUpdateNickname = async (uid: string, newNick: string) => {
    await updateDoc(doc(db, "users", uid), { nickname: newNick });
  };

  const togglePin = async (user: any) => {
    await updateDoc(doc(db, "users", user.id), { isPinned: !user.isPinned });
  };

  const toggleBan = async (user: any) => {
    const confirmMsg = user.isBanned 
      ? `ID「${user.id}」の凍結(BAN)を解除しますか？` 
      : `ID「${user.id}」を凍結(操作禁止)にしますか？`;
      
    if (!confirm(confirmMsg)) return;
    await updateDoc(doc(db, "users", user.id), { isBanned: !user.isBanned });
  };

  const wipeUserData = async (targetUid: string) => {
    if (!confirm(`【危険】ユーザーID: ${targetUid} の全予約データを強制削除します。\n枠を空けますか？`)) return;
    let deletedCount = 0;
    for (const shop of attractions) {
        // 予約の削除
        if (shop.reservations) {
            const targetRes = shop.reservations.filter((r: any) => r.userId === targetUid);
            if (targetRes.length > 0) {
                const newRes = shop.reservations.filter((r: any) => r.userId !== targetUid);
                let newSlots = { ...shop.slots };
                targetRes.forEach((r: any) => {
                    if (newSlots[r.time] > 0) newSlots[r.time]--;
                });
                await updateDoc(doc(db, "attractions", shop.id), {
                    reservations: newRes, slots: newSlots
                });
                deletedCount += targetRes.length;
            }
        }
        // 行列(Queue)の削除も行う
        if (shop.queue) {
            const targetQueue = shop.queue.filter((q: any) => q.userId === targetUid);
            if (targetQueue.length > 0) {
                const newQueue = shop.queue.filter((q: any) => q.userId !== targetUid);
                await updateDoc(doc(db, "attractions", shop.id), { queue: newQueue });
                deletedCount += targetQueue.length;
            }
        }
    }
    alert(`完了: ${deletedCount} 件のデータ(予約・行列)を削除しました。`);
  };

  const deleteUserFromDb = async (targetUid: string) => {
    if(!confirm(`ユーザー「${targetUid}」をデータベースから完全に削除しますか？\n(注意: 戻せません)`)) return;
    await deleteDoc(doc(db, "users", targetUid));
  };

  const filteredDbUsers = users.filter(u => {
      const q = dbSearchQuery.toLowerCase();
      const idMatch = u.id.toLowerCase().includes(q);
      const nickMatch = u.nickname && u.nickname.toLowerCase().includes(q);
      return idMatch || nickMatch;
  }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.id.localeCompare(b.id);
  });


  // =================================================================
  //  機能群 2: 会場管理・予約操作
  // =================================================================

  const allUserIds = useMemo(() => {
      const ids = new Set<string>();
      attractions.forEach(shop => {
          shop.reservations?.forEach((res: any) => { if (res.userId) ids.add(res.userId); });
          shop.queue?.forEach((q: any) => { if (q.userId) ids.add(q.userId); }); // Queueも検索対象に
          shop.allowedUsers?.forEach((id: string) => ids.add(id));
          shop.bannedUsers?.forEach((id: string) => ids.add(id));
          shop.adminAllowedUsers?.forEach((id: string) => ids.add(id));
          shop.adminBannedUsers?.forEach((id: string) => ids.add(id));
      });
      return Array.from(ids).sort();
  }, [attractions]);

  const filteredSidebarIds = useMemo(() => {
      if (!userSearchQuery) return allUserIds;
      const q = userSearchQuery.toLowerCase();
      
      return allUserIds.filter(id => {
          const idMatch = id.toLowerCase().includes(q);
          const nickname = getUserNickname(id);
          const nickMatch = nickname.toLowerCase().includes(q);
          return idMatch || nickMatch;
      });
  }, [allUserIds, userSearchQuery, users]);

  const selectUser = (id: string) => {
      setTargetStudentId(id);
      setConfigInputUserId(id);
  };

  const toggleGlobalPause = async (currentState: boolean) => {
      if(!confirm(currentState ? "全店舗の受付を再開させますか？" : "全店舗 緊急停止しますか？")) return;
      attractions.forEach(async (shop) => {
          await updateDoc(doc(db, "attractions", shop.id), { isPaused: !currentState });
      });
  };

  const toggleListMode = async (type: "guest" | "student") => {
      if (!selectedConfigShopId) return;
      const targetShop = attractions.find(s => s.id === selectedConfigShopId);
      if(!targetShop) return;
      
      const field = type === "guest" ? "guestListType" : "studentListType";
      const currentMode = targetShop[field] === "white" ? "white" : "black";
      const newMode = currentMode === "white" ? "black" : "white";
      
      if (!confirm(`設定を「${newMode === "white" ? "ホワイトリスト(許可制)" : "ブラックリスト(拒否制)"}」に変更しますか？`)) return;
      
      const updates: any = { [field]: newMode };
      
      if (type === "guest") {
          updates.isRestricted = (newMode === "white");
      }
      if (type === "student") {
          updates.isAdminRestricted = (newMode === "white");
      }

      await updateDoc(doc(db, "attractions", selectedConfigShopId), updates);
  };

  const addAllUsersToWhiteList = async (type: "guest" | "student") => {
      if (!selectedConfigShopId) return;
      const targetShop = attractions.find(s => s.id === selectedConfigShopId);
      if(!targetShop) return;
      const field = type === "guest" ? "allowedUsers" : "adminAllowedUsers";
      const currentList = targetShop[field] || [];
      const idsToAdd = allUserIds.filter(id => !currentList.includes(id));
      if(idsToAdd.length === 0) return alert("追加対象がいません");
      if(!confirm(`全ユーザー(${idsToAdd.length}人)を許可リストに追加しますか？`)) return;
      await updateDoc(doc(db, "attractions", selectedConfigShopId), { [field]: arrayUnion(...idsToAdd) });
  };

  const handleListUpdate = async (type: "guest" | "student", action: "add" | "remove", userId: string) => {
      if (!userId || !selectedConfigShopId) return;
      const isUiWhite = type === "guest" ? showGuestWhite : showStudentWhite;
      const targetField = type === "guest" 
          ? (isUiWhite ? "allowedUsers" : "bannedUsers")
          : (isUiWhite ? "adminAllowedUsers" : "adminBannedUsers");
      await updateDoc(doc(db, "attractions", selectedConfigShopId), {
          [targetField]: action === "add" ? arrayUnion(userId) : arrayRemove(userId)
      });
      if(action === "add") setConfigInputUserId(""); 
  };

  // ★変更: 予約だけでなく行列(Queue)も含めて取得する
  const fetchStudentData = () => {
    if(!targetStudentId) return alert("ユーザーを選択してください");
    const foundReservations: any[] = [];
    attractions.forEach(shop => {
        // 予約の検索
        shop.reservations?.forEach((res: any) => {
            if(res.userId === targetStudentId) foundReservations.push({ shopId: shop.id, shopName: shop.name, ...res, isQueue: false });
        });
        // 行列の検索 (Queue)
        shop.queue?.forEach((q: any) => {
            if(q.userId === targetStudentId) foundReservations.push({ 
                shopId: shop.id, 
                shopName: shop.name, 
                time: "順番待ち", // 行列の場合は時刻なし
                ...q, 
                isQueue: true // 判別フラグ
            });
        });
    });
    setStudentReservations(foundReservations);
    setIsModalOpen(true);
  };

  const forceToggleStatus = async (res: any, status: "used" | "reserved") => {
      const shop = attractions.find(s => s.id === res.shopId);
      if(!shop) return;
      // 行列の場合はステータス変更できない（もしくは別のロジックが必要だが、一旦予約のみ対象とする）
      if(res.isQueue) return alert("順番待ちの状態はここから変更できません。");

      const otherRes = shop.reservations.filter((r: any) => r.timestamp !== res.timestamp);
      const updatedRes = { ...res, status };
      delete updatedRes.shopId; delete updatedRes.shopName; delete updatedRes.isQueue;
      await updateDoc(doc(db, "attractions", res.shopId), { reservations: [...otherRes, updatedRes] });
      fetchStudentData(); 
  };

  // ★変更: 予約か行列かを判定して削除
  const forceDeleteReservation = async (res: any) => {
      if(!confirm(`削除しますか？`)) return;
      const shop = attractions.find(s => s.id === res.shopId);
      if(!shop) return;

      if (res.isQueue) {
          // 行列からの削除
          const otherQueue = shop.queue.filter((q: any) => q.timestamp !== res.timestamp);
          await updateDoc(doc(db, "attractions", res.shopId), { queue: otherQueue });
      } else {
          // 予約からの削除
          const otherRes = shop.reservations.filter((r: any) => r.timestamp !== res.timestamp);
          // スロットの解放
          const updatedSlots = { ...shop.slots, [res.time]: Math.max(0, (shop.slots[res.time] || 1) - 1) };
          await updateDoc(doc(db, "attractions", res.shopId), { reservations: otherRes, slots: updatedSlots });
      }
      setIsModalOpen(false); fetchStudentData();
  };

  const forceAddReservation = async () => {
      if(!addShopId || !addTime) return alert("会場と時間を選択してください");
      const shop = attractions.find(s => s.id === addShopId);
      if(!shop) return;
      
      const newRes = { 
          userId: targetStudentId, 
          timestamp: Date.now(), 
          time: addTime, 
          status: "reserved",
          count: Number(addCount)
      };

      const updatedSlots = { ...shop.slots, [addTime]: (shop.slots?.[addTime] || 0) + 1 };
      await updateDoc(doc(db, "attractions", addShopId), {
          reservations: [...(shop.reservations || []), newRes], slots: updatedSlots
      });
      alert(`強制予約完了`);
      fetchStudentData();
  };

  // ★新機能: 強制的に行列に追加する関数
  const forceAddToQueue = async () => {
      if (!addShopId) return alert("会場を選択してください");
      // 時間は不要なのでチェックしない
      const shop = attractions.find(s => s.id === addShopId);
      if (!shop) return;

      const newQueueItem = {
          userId: targetStudentId,
          timestamp: Date.now(),
          count: Number(addCount),
          status: "waiting"
      };

      await updateDoc(doc(db, "attractions", addShopId), {
          queue: arrayUnion(newQueueItem)
      });

      alert("行列(順番待ち)に強制追加しました");
      fetchStudentData();
  };

  const targetShop = attractions.find(s => s.id === selectedConfigShopId);
  const targetShopTimes = useMemo(() => {
      const shop = attractions.find(s => s.id === addShopId);
      return shop && shop.slots ? Object.keys(shop.slots).sort() : [];
  }, [addShopId, attractions]);


  return (
    <div className="flex flex-col h-screen bg-black text-green-500 font-mono overflow-hidden">
      
      {/* ================= ヘッダー (タブ切り替え) ================= */}
      <header className="flex justify-between items-center bg-gray-900 border-b border-green-900 px-4 py-2 shrink-0">
          <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white tracking-widest">管理<span className="text-green-500">コンソール</span></h1>
              <div className="flex bg-black rounded border border-gray-700 p-1">
                  <button 
                    onClick={() => setActiveTab("venues")}
                    className={`px-4 py-1 rounded text-sm transition ${activeTab === "venues" ? "bg-green-700 text-white font-bold" : "text-gray-400 hover:text-white"}`}
                  >
                    📍 会場・予約管理
                  </button>
                  <button 
                    onClick={() => setActiveTab("users")}
                    className={`px-4 py-1 rounded text-sm transition ${activeTab === "users" ? "bg-blue-700 text-white font-bold" : "text-gray-400 hover:text-white"}`}
                  >
                    👤 ユーザーデータベース
                  </button>
              </div>
          </div>
          <div className="text-xs text-gray-500 font-mono">MyID: {myUserId}</div>
      </header>


      {/* ========================================================================= */}
      {/* タブ 1: 会場・予約管理                                                 */}
      {/* ========================================================================= */}
      {activeTab === "venues" && (
        <div className="flex flex-1 overflow-hidden">
            {/* 左サイドバー (ユーザー選択) */}
            <aside className="w-1/4 min-w-[250px] border-r border-green-900 flex flex-col bg-gray-900/50">
                <div className="p-4 border-b border-green-900">
                    <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase">ユーザー検索・選択</h2>
                    <input 
                        className="w-full bg-black text-white border border-gray-600 p-2 text-sm rounded outline-none focus:border-green-500 placeholder-gray-600"
                        placeholder="ID または 名前で検索..."
                        value={userSearchQuery}
                        onChange={e => setUserSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredSidebarIds.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-600">見つかりません</div>
                    )}
                    {filteredSidebarIds.map(id => {
                        const nickname = getUserNickname(id);
                        return (
                            <button key={id} onClick={() => selectUser(id)}
                                className={`w-full text-left p-3 border-b border-gray-800 hover:bg-green-900/30 flex justify-between items-center group
                                ${(targetStudentId === id || configInputUserId === id) ? "bg-green-900/50 border-l-4 border-l-green-500" : ""}`}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold text-white text-sm group-hover:text-green-300">
                                        {nickname || <span className="text-gray-600 italic font-normal text-xs">(未設定)</span>}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono group-hover:text-green-500">{id}</span>
                                </div>
                                {(targetStudentId === id) && <span className="text-green-500 text-xs">●</span>}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* 右メインコンテンツ */}
            <main className="flex-1 overflow-y-auto p-6 relative">
                {/* ユーザー操作パネル */}
                <section className="mb-10 bg-blue-900/10 border border-blue-800 rounded p-6 shadow-lg shadow-blue-900/20">
                    <h2 className="text-lg font-bold text-blue-400 mb-4">特定ユーザー操作</h2>
                    <div className="flex gap-4">
                        <input className="flex-1 bg-black border border-blue-500 text-white p-3 rounded text-xl font-mono" 
                            placeholder="ID未選択 (左リストから選択)" value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value.toUpperCase())}
                        />
                        <button onClick={fetchStudentData} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded">詳細・予約操作</button>
                    </div>
                    {targetStudentId && (
                        <p className="mt-2 text-sm text-gray-400">
                            現在の名前: <span className="text-white font-bold">{getUserNickname(targetStudentId) || "なし"}</span>
                        </p>
                    )}
                </section>

                {/* 会場設定・緊急停止 */}
                {!showVenueConfig && (
                    <section className="animate-fade-in mb-10">
                        <div className="border border-red-900/50 p-6 rounded bg-red-900/10 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-red-500">⚠️ 全店舗 緊急操作</h2>
                                <p className="text-sm text-gray-400">停止中: {attractions.filter(a => a.isPaused).length} 店舗</p>
                            </div>
                            <button onClick={() => toggleGlobalPause(attractions.every(a => a.isPaused))} className="bg-red-800 hover:bg-red-700 text-white font-bold px-6 py-3 rounded border border-red-500">
                                {attractions.every(a => a.isPaused) ? "全店舗を一括再開" : "全店舗を緊急停止"}
                            </button>
                        </div>
                    </section>
                )}

                {/* 会場リスト設定 */}
                <div className="border-t border-gray-800 pt-6">
                    <button onClick={() => setShowVenueConfig(!showVenueConfig)} className="w-full py-4 px-6 rounded bg-gray-900 border border-green-900 text-left flex justify-between items-center">
                        <span className="text-xl font-bold text-green-400">🛠️ 会場設定 (入場リスト管理)</span>
                        <span>{showVenueConfig ? "▲" : "▼"}</span>
                    </button>

                    {showVenueConfig && (
                        <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded animate-fade-in">
                            {!selectedConfigShopId ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {attractions.map(shop => (
                                        <button key={shop.id} onClick={() => setSelectedConfigShopId(shop.id)} className={`p-5 rounded border text-left hover:bg-gray-800 transition ${shop.isPaused ? 'border-red-500 bg-red-900/20' : 'border-gray-600 bg-black'}`}>
                                            <div className="text-xl font-mono text-yellow-500 mb-1">{shop.id}</div>
                                            <div className="font-bold text-white">{shop.name}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : targetShop && (
                                <div>
                                    <div className="flex items-center gap-4 mb-6 border-b border-gray-700 pb-4">
                                        <button onClick={() => setSelectedConfigShopId(null)} className="px-3 py-1 bg-gray-800 rounded">← 戻る</button>
                                        <h2 className="text-2xl font-bold text-white"><span className="text-yellow-400">{targetShop.id}</span> {targetShop.name}</h2>
                                    </div>
                                    <div className="flex justify-between items-center bg-black p-4 rounded border border-gray-600 mb-6">
                                        <h3 className="font-bold text-white">受付ステータス</h3>
                                        <button onClick={() => updateDoc(doc(db, "attractions", targetShop.id), { isPaused: !targetShop.isPaused })} 
                                            className={`px-6 py-2 rounded font-bold ${targetShop.isPaused ? 'bg-red-600' : 'bg-green-600 text-black'}`}>
                                            {targetShop.isPaused ? "現在: 停止中 (再開する)" : "現在: 稼働中 (停止する)"}
                                        </button>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-xs text-gray-500">リスト操作対象ID</label>
                                        <input className="w-full bg-black text-white border border-green-500 p-2 rounded" placeholder="IDを入力..." value={configInputUserId} onChange={e => setConfigInputUserId(e.target.value.toUpperCase())} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* 一般客設定 */}
                                        <div className={`p-4 rounded border ${showGuestWhite ? 'border-white bg-green-900/20' : 'border-gray-600 bg-black'}`}>
                                            <div className="flex justify-between mb-2"><h3 className="font-bold">一般客設定</h3><button onClick={() => toggleListMode("guest")} className="text-xs bg-gray-700 px-2 rounded">モード切替</button></div>
                                            <p className="text-xs text-gray-400 mb-2">{showGuestWhite ? "ホワイトリスト (許可された人のみ)" : "ブラックリスト (拒否設定以外はOK)"}</p>
                                            <button onClick={() => handleListUpdate("guest", "add", configInputUserId)} className={`w-full py-2 rounded font-bold mb-2 ${showGuestWhite ? 'bg-green-700' : 'bg-red-900'}`}>追加</button>
                                            {showGuestWhite && <button onClick={() => addAllUsersToWhiteList("guest")} className="w-full py-1 mb-2 bg-green-900/50 border border-green-500 text-xs">＋ 全員許可</button>}
                                            <ul className="max-h-40 overflow-y-auto text-sm">{(showGuestWhite ? targetShop.allowedUsers : targetShop.bannedUsers)?.map((uid: string) => (
                                                <li key={uid} className="flex justify-between border-b border-gray-700 py-1"><span>{uid}</span><button onClick={() => handleListUpdate("guest", "remove", uid)} className="text-red-500">削除</button></li>
                                            ))}</ul>
                                        </div>
                                        {/* 生徒設定 */}
                                        <div className={`p-4 rounded border ${showStudentWhite ? 'border-blue-400 bg-blue-900/10' : 'border-purple-900 bg-purple-900/10'}`}>
                                            <div className="flex justify-between mb-2"><h3 className="font-bold text-blue-300">運営生徒設定</h3><button onClick={() => toggleListMode("student")} className="text-xs bg-gray-700 px-2 rounded">モード切替</button></div>
                                            <p className="text-xs text-gray-400 mb-2">{showStudentWhite ? "ホワイトリスト (許可制)" : "ブラックリスト (拒否制)"}</p>
                                            <button onClick={() => handleListUpdate("student", "add", configInputUserId)} className={`w-full py-2 rounded font-bold mb-2 ${showStudentWhite ? 'bg-blue-600' : 'bg-purple-800'}`}>追加</button>
                                            {showStudentWhite && <button onClick={() => addAllUsersToWhiteList("student")} className="w-full py-1 mb-2 bg-blue-900/50 border border-blue-500 text-xs">＋ 全員許可</button>}
                                            <ul className="max-h-40 overflow-y-auto text-sm">{(showStudentWhite ? targetShop.adminAllowedUsers : targetShop.adminBannedUsers)?.map((uid: string) => (
                                                <li key={uid} className="flex justify-between border-b border-gray-700 py-1"><span>{uid}</span><button onClick={() => handleListUpdate("student", "remove", uid)} className="text-red-500">削除</button></li>
                                            ))}</ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
      )}


      {/* ========================================================================= */}
      {/* タブ 2: ユーザーデータベース管理                                       */}
      {/* ========================================================================= */}
      {activeTab === "users" && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-900">
              <div className="max-w-6xl mx-auto">
                  <div className="bg-black border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                          <h2 className="text-2xl font-bold text-white mb-2">ユーザーデータベース管理</h2>
                          <input 
                              className="w-full bg-black border border-gray-600 rounded p-3 text-white focus:border-blue-500 outline-none placeholder-gray-500"
                              placeholder="ユーザーID または ニックネームで検索..."
                              value={dbSearchQuery}
                              onChange={(e) => setDbSearchQuery(e.target.value)}
                          />
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm text-gray-300">
                              <thead className="bg-gray-800 text-xs uppercase text-gray-500 font-bold">
                                  <tr>
                                      <th className="px-6 py-4">ユーザーID</th>
                                      <th className="px-6 py-4">ニックネーム / メモ</th>
                                      <th className="px-6 py-4 text-center">ピン留め</th>
                                      <th className="px-6 py-4 text-center">状態 (BAN)</th>
                                      <th className="px-6 py-4 text-right">操作</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800">
                                  {filteredDbUsers.map(user => (
                                      <tr key={user.id} className={`hover:bg-gray-800/50 transition ${user.isBanned ? 'bg-red-900/10' : ''}`}>
                                          <td className="px-6 py-4 font-mono font-bold text-yellow-400 text-lg">
                                              {user.id}
                                              {user.id === myUserId && <span className="ml-2 bg-green-600 text-black text-[10px] px-2 rounded">YOU</span>}
                                          </td>
                                          <td className="px-6 py-4">
                                              <NicknameInput 
                                                  userId={user.id}
                                                  initialValue={user.nickname || ""}
                                                  onSave={handleUpdateNickname}
                                              />
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                              <button onClick={() => togglePin(user)} className={`text-xl transition hover:scale-125 ${user.isPinned ? 'opacity-100' : 'opacity-20 hover:opacity-100'}`}>
                                                  📌
                                              </button>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                              <button 
                                                  onClick={() => toggleBan(user)} 
                                                  className={`px-4 py-1 rounded text-xs font-bold transition border ${user.isBanned ? 'bg-red-600 border-red-500 text-white hover:bg-red-500' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                              >
                                                  {user.isBanned ? "凍結中" : "通常"}
                                              </button>
                                          </td>
                                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                                              <button onClick={() => wipeUserData(user.id)} className="bg-orange-900/50 hover:bg-orange-700 text-orange-200 border border-orange-800 px-3 py-1 rounded text-xs">
                                                  全データ削除
                                              </button>
                                              <button onClick={() => deleteUserFromDb(user.id)} className="bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white px-3 py-1 rounded text-xs">
                                                  🗑️
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                                  {filteredDbUsers.length === 0 && (
                                      <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">ユーザーが見つかりません</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ================= モーダル (予約詳細・修正済) ================= */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-gray-900 border border-green-600 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                          <h2 className="text-xl font-bold text-white">予約詳細</h2>
                          <p className="text-green-500 font-mono">{targetStudentId}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                  </div>
                  
                  {/* 予約リスト表示 */}
                  <div className="mb-8">
                      <h3 className="font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1">現在の予約・行列 ({studentReservations.length}件)</h3>
                      {studentReservations.length === 0 ? (
                          <p className="text-gray-600">予約はありません</p>
                      ) : (
                          <ul className="space-y-3">
                              {studentReservations.map((res, i) => (
                                  <li key={i} className={`border p-3 rounded flex justify-between items-center ${res.isQueue ? 'bg-yellow-900/10 border-yellow-800' : 'bg-black border-gray-700'}`}>
                                      <div>
                                          <div className="text-yellow-500 text-sm">{res.shopName}</div>
                                          <div className="text-white text-lg font-bold flex items-center gap-2">
                                              {res.time} 
                                              {/* ★変更点: 時間の右隣に人数を表示 */}
                                              <span className="text-sm text-blue-300">({res.count || 1}名)</span>
                                              {res.isQueue && <span className="text-xs bg-yellow-600 text-black px-1 rounded font-bold">行列</span>}
                                          </div>
                                          <div className={`text-xs ${res.status === 'used' ? 'text-gray-500' : 'text-green-400'}`}>
                                              {res.status === 'used' ? "使用済み" : (res.isQueue ? "順番待ち" : "予約中")}
                                          </div>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                          {!res.isQueue && (
                                              <button onClick={() => forceToggleStatus(res, res.status === 'used' ? 'reserved' : 'used')} className="text-xs bg-gray-800 px-2 py-1 rounded text-white border border-gray-600">
                                                  {res.status === 'used' ? "未使用に戻す" : "使用済みにする"}
                                              </button>
                                          )}
                                          <button onClick={() => forceDeleteReservation(res)} className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded border border-red-800">
                                              削除
                                          </button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>

                  {/* 強制予約システム (修正版) */}
                  <div className="bg-blue-900/10 border border-blue-800 p-4 rounded">
                      <h3 className="font-bold text-blue-400 mb-2">強制予約システム (割り込み)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <select className="bg-black border border-gray-600 text-white p-2 rounded" value={addShopId} onChange={e => setAddShopId(e.target.value)}>
                              <option value="">会場を選択...</option>
                              {attractions.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                          </select>
                          <select className="bg-black border border-gray-600 text-white p-2 rounded" value={addTime} onChange={e => setAddTime(e.target.value)} disabled={!addShopId}>
                              <option value="">時間を選択...</option>
                              {targetShopTimes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                      
                      <div className="flex gap-3 items-end">
                          {/* ★変更点: 人数選択用の入力欄を追加 */}
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 block mb-1">人数</label>
                            <input 
                                type="number" 
                                min="1" 
                                className="w-full bg-black border border-gray-600 text-white p-2 rounded"
                                value={addCount}
                                onChange={(e) => setAddCount(Number(e.target.value))}
                            />
                          </div>

                          <button onClick={forceAddReservation} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded h-[42px] whitespace-nowrap">
                             強制予約(時間)
                          </button>
                          
                          {/* ★新機能: 行列追加ボタン */}
                          <button onClick={forceAddToQueue} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded h-[42px] whitespace-nowrap">
                             行列に追加
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}


