// ＃生徒会用管理画面 (app/admin/super/page.tsx)
"use client";
import { useState, useEffect, useMemo } from "react";
import { db, auth } from "../../../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

const convertGoogleDriveLink = (url: string) => {
  if (!url) return "";
  if (!url.includes("drive.google.com") || url.includes("export=view")) return url;
  try {
    const id = url.split("/d/")[1].split("/")[0];
    return `https://drive.google.com/uc?export=view&id=${id}`;
  } catch (e) { return url; }
};

// ─────────────────────────────────────────
//  全削除確認モーダル
// ─────────────────────────────────────────
function DestroyModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [code] = useState(() => {
    // 6桁の乱数（数字）を生成
    return String(Math.floor(100000 + Math.random() * 900000));
  });
  const [input, setInput] = useState("");
  const matched = input === code;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-red-700 shadow-2xl shadow-red-900/40 w-full max-w-md p-6 animate-fade-in">
        {/* アイコン＋タイトル */}
        <div className="flex flex-col items-center mb-6 gap-3">
          <div className="text-5xl">💀</div>
          <h2 className="text-xl font-black text-red-500 tracking-wide text-center">
            全データ削除 — 最終確認
          </h2>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            全会場の <span className="text-red-300 font-bold">UID・予約・待機列・会場データ</span> を完全に削除します。<br />
            この操作は <span className="text-white font-bold">復元できません</span>。
          </p>
        </div>

        {/* 確認コード表示 */}
        <div className="bg-black border border-red-800 rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest">下のコードを入力してください</div>
          <div className="text-4xl font-black font-mono tracking-[0.3em] text-red-400 select-all">
            {code}
          </div>
        </div>

        {/* 入力欄 */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={input}
          onChange={e => setInput(e.target.value.replace(/\D/g, ""))}
          placeholder="6桁のコードを入力"
          className={`w-full text-center text-2xl font-mono font-bold p-3 rounded-xl bg-gray-800 outline-none border-2 mb-5 tracking-[0.25em] transition
            ${matched ? "border-green-500 text-green-400" : "border-gray-700 text-white"}
          `}
        />

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-sm font-bold border border-gray-700 transition"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={!matched}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-black transition shadow-lg shadow-red-900/50"
          >
            削除を実行
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  メインコンポーネント
// ─────────────────────────────────────────
export default function SuperAdminPage() {
  const [attractions, setAttractions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]); // users collection
  const [myUserId, setMyUserId] = useState("");

  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalId, setOriginalId] = useState<string | null>(null);

  // フォーム
  const [manualId, setManualId] = useState("");
  const [newName, setNewName] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [groupLimit, setGroupLimit] = useState(4);
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("15:00");
  const [duration, setDuration] = useState(20);
  const [capacity, setCapacity] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [releaseBeforeTime, setReleaseBeforeTime] = useState("00:00");
  const [isQueueMode, setIsQueueMode] = useState(false);

  const [searchUserId, setSearchUserId] = useState("");
  const [now, setNow] = useState(new Date());
  const [guestTime, setGuestTime] = useState("");

  // ★ゲスト枠追加モーダル
  const [guestModalShopId, setGuestModalShopId] = useState<string | null>(null);
  const [guestSelectedTime, setGuestSelectedTime] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  // ★全削除確認モーダル
  const [showDestroyModal, setShowDestroyModal] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    let stored = localStorage.getItem("bunkasai_user_id");
    if (!stored) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      stored = result;
      localStorage.setItem("bunkasai_user_id", stored);
    }
    setMyUserId(stored);

    const unsubAttractions = onSnapshot(collection(db, "attractions"), (snapshot) => {
      setAttractions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { unsubAttractions(); unsubUsers(); clearInterval(timer); };
  }, []);

  const stats = useMemo(() => {
    const totalVenues = attractions.length;
    const pausedVenues = attractions.filter(a => a.isPaused).length;
    const totalReservations = attractions.reduce((sum, shop) => {
      if (shop.isQueueMode && shop.queue)
        return sum + shop.queue.filter((t: any) => ['waiting', 'ready'].includes(t.status)).length;
      return sum + (shop.reservations?.length || 0);
    }, 0);
    return {
      totalVenues: String(totalVenues).padStart(3, '0'),
      pausedVenues: String(pausedVenues).padStart(3, '0'),
      totalReservations: String(totalReservations).padStart(7, '0'),
    };
  }, [attractions]);

  // ─── 一斉操作 ───
  const handleBulkPause = async (shouldPause: boolean) => {
    if (!confirm(`全ての会場を「${shouldPause ? "一斉停止" : "一斉再開"}」しますか？`)) return;
    try {
      await Promise.all(attractions.map(shop => updateDoc(doc(db, "attractions", shop.id), { isPaused: shouldPause })));
      alert("完了しました。");
    } catch (e) { alert("エラーが発生しました。"); }
  };

  const handleBulkDeleteReservations = async () => {
    if (!confirm("【危険】全会場の「予約データ」および「待機列」を全て削除します。\n本当によろしいですか？")) return;
    if (prompt("確認のため 'DELETE' と入力してください") !== "DELETE") return;
    try {
      await Promise.all(attractions.map(shop => {
        const resetSlots: any = {};
        Object.keys(shop.slots || {}).forEach(key => { resetSlots[key] = 0; });
        return updateDoc(doc(db, "attractions", shop.id), { reservations: [], queue: [], slots: resetSlots });
      }));
      alert("完了しました。");
    } catch (e) { alert("エラーが発生しました。"); }
  };

  // ★変更: 全UID（usersコレクション）・会場データを両方削除（モーダル経由）
  const handleBulkDestroyAll = async () => {
    try {
      // attractions（会場・予約・待機列）を全削除
      await Promise.all(attractions.map(shop => deleteDoc(doc(db, "attractions", shop.id))));
      // users（UID・ニックネーム・BAN情報）を全削除
      await Promise.all(users.map(user => deleteDoc(doc(db, "users", user.id))));
      setExpandedShopId(null);
      setShowDestroyModal(false);
      alert("全会場データ・全UIDを削除しました。");
    } catch (e) { alert("エラーが発生しました。"); }
  };

  // ─── フォーム操作 ───
  const resetForm = () => {
    setIsEditing(false); setOriginalId(null);
    setManualId(""); setNewName(""); setPassword("");
    setDepartment(""); setImageUrl(""); setDescription("");
    setGroupLimit(4); setOpenTime("10:00"); setCloseTime("15:00");
    setDuration(20); setCapacity(3); setIsPaused(false);
    setReleaseBeforeTime("00:00"); setIsQueueMode(false);
  };

  const startEdit = (shop: any) => {
    setIsEditing(true); setOriginalId(shop.id);
    setManualId(shop.id); setNewName(shop.name); setPassword(shop.password);
    setDepartment(shop.department || ""); setImageUrl(shop.imageUrl || ""); setDescription(shop.description || "");
    setGroupLimit(shop.groupLimit || 4); setOpenTime(shop.openTime);
    setCloseTime(shop.closeTime); setDuration(shop.duration);
    setCapacity(shop.capacity); setIsPaused(shop.isPaused || false);
    setReleaseBeforeTime(shop.releaseBeforeTime || "00:00"); setIsQueueMode(shop.isQueueMode || false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!manualId || !newName || !password) return alert("必須項目(ID, 会場名, Pass)を入力してください");
    if (password.length !== 5) return alert("パスワードは5桁です");
    if (isEditing && originalId !== manualId && attractions.some(s => s.id === manualId))
      return alert(`ID「${manualId}」は既に存在します。`);

    let slots: any = {}; let shouldResetSlots = true;
    let existingReservations: any[] = []; let existingQueue: any[] = [];

    if (isEditing) {
      const currentShop = attractions.find(s => s.id === originalId);
      if (currentShop) {
        existingReservations = currentShop.reservations || [];
        existingQueue = currentShop.queue || [];
        if (currentShop.openTime === openTime && currentShop.closeTime === closeTime && currentShop.duration === duration) {
          slots = currentShop.slots || {}; shouldResetSlots = false;
        } else {
          if (!isQueueMode && !confirm("時間を変更すると、現在の予約枠がリセットされます。よろしいですか？")) return;
        }
      }
    }

    if (shouldResetSlots) {
      let current = new Date(`2000/01/01 ${openTime}`);
      const end = new Date(`2000/01/01 ${closeTime}`);
      slots = {};
      while (current < end) {
        const timeStr = current.toTimeString().substring(0, 5);
        slots = { ...slots, [timeStr]: 0 };
        current.setMinutes(current.getMinutes() + duration);
      }
    }

    const data: any = {
      name: newName, password, groupLimit, department, imageUrl, description,
      openTime, closeTime, duration, capacity, isPaused, slots,
      isQueueMode, releaseBeforeTime,
      reservations: isEditing ? existingReservations : [],
      queue: isEditing ? existingQueue : [],
    };

    try {
      if (isEditing && originalId && manualId !== originalId) {
        if (!confirm(`会場IDを「${originalId}」から「${manualId}」に変更しますか？`)) return;
        await setDoc(doc(db, "attractions", manualId), data);
        await deleteDoc(doc(db, "attractions", originalId));
        setExpandedShopId(manualId);
      } else {
        await setDoc(doc(db, "attractions", manualId), data, { merge: true });
        if (isEditing) setExpandedShopId(manualId);
      }
      alert(isEditing ? "更新しました" : "作成しました");
      resetForm();
    } catch (e) { alert("エラーが発生しました"); }
  };

  const handleDeleteVenue = async (id: string) => {
    if (!confirm("本当に会場を削除しますか？")) return;
    await deleteDoc(doc(db, "attractions", id));
    setExpandedShopId(null);
  };

  // ─── 予約操作 ───
  const toggleReservationStatus = async (shop: any, res: any, newStatus: "reserved" | "used") => {
    if (!confirm(newStatus === "used" ? "入場済みにしますか？" : "入場を取り消しますか？")) return;
    const otherRes = shop.reservations.filter((r: any) => r.timestamp !== res.timestamp);
    await updateDoc(doc(db, "attractions", shop.id), { reservations: [...otherRes, { ...res, status: newStatus }] });
  };

  const cancelReservation = async (shop: any, res: any) => {
    if (!confirm(`User ID: ${res.userId}\nこの予約を削除しますか？`)) return;
    const otherRes = shop.reservations.filter((r: any) => r.timestamp !== res.timestamp);
    const updatedSlots = { ...shop.slots, [res.time]: Math.max(0, shop.slots[res.time] - 1) };
    await updateDoc(doc(db, "attractions", shop.id), { reservations: otherRes, slots: updatedSlots });
  };

  // ─── キュー操作 ───
  const updateQueueStatus = async (shop: any, ticket: any, newStatus: 'waiting' | 'ready' | 'completed' | 'canceled') => {
    let msg = "";
    if (newStatus === 'ready') msg = "呼び出しを行いますか？";
    if (newStatus === 'completed') msg = "入場済みにし、リストから削除しますか？";
    if (newStatus === 'canceled') msg = "強制取消しますか？";
    if (newStatus !== 'waiting' && !confirm(msg)) return;

    if (newStatus === 'completed' || newStatus === 'canceled') {
      const newQueue = shop.queue.filter((t: any) =>
        ticket.ticketId ? t.ticketId !== ticket.ticketId : t.userId !== ticket.userId
      );
      await updateDoc(doc(db, "attractions", shop.id), { queue: newQueue });
    } else {
      const updatedQueue = shop.queue.map((t: any) => {
        const isMatch = ticket.ticketId ? t.ticketId === ticket.ticketId : t.userId === ticket.userId;
        return isMatch ? { ...t, status: newStatus } : t;
      });
      await updateDoc(doc(db, "attractions", shop.id), { queue: updatedQueue });
    }
  };

  // ─── ゲスト採番 ───
  const generateGuestId = (shop: any) => {
    let maxNum = 0;
    const check = (id: string) => {
      if (id?.startsWith('G')) {
        const n = parseInt(id.substring(1), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    };
    (shop.queue || []).forEach((q: any) => check(q.userId));
    (shop.reservations || []).forEach((r: any) => check(r.userId));
    return `G${String(maxNum + 1).padStart(5, '0')}`;
  };

  // ─── ゲスト枠モーダル ───
  const openGuestModal = (shop: any) => {
    setGuestModalShopId(shop.id);
    setGuestSelectedTime("");
    setGuestCount(1);
  };

  const handleAddGuestSlot = async () => {
    if (!guestModalShopId) return;
    const shop = attractions.find(s => s.id === guestModalShopId);
    if (!shop) return;
    const guestId = generateGuestId(shop);
    const timestamp = Date.now();

    if (shop.isQueueMode) {
      const newTicket = { ticketId: guestId, userId: guestId, count: guestCount, status: "waiting", timestamp, isGuest: true };
      await updateDoc(doc(db, "attractions", shop.id), { queue: [...(shop.queue || []), newTicket] });
      alert(`ゲスト枠を追加しました\nGuest ID: ${guestId}`);
    } else {
      if (!guestSelectedTime) return alert("時間を選択してください");
      const slotCount = shop.slots?.[guestSelectedTime] ?? 0;
      if (slotCount >= shop.capacity) return alert("この枠は満員です");
      const newRes = { userId: guestId, time: guestSelectedTime, count: guestCount, status: "reserved", timestamp, isGuest: true };
      await updateDoc(doc(db, "attractions", shop.id), {
        reservations: [...(shop.reservations || []), newRes],
        slots: { ...shop.slots, [guestSelectedTime]: slotCount + 1 },
      });
      alert(`ゲスト枠を追加しました\nGuest ID: ${guestId}\n時間: ${guestSelectedTime}`);
    }
    setGuestModalShopId(null);
  };

  // ─── 表示ヘルパー ───
  const targetShop = attractions.find(s => s.id === expandedShopId);
  const guestModalShop = attractions.find(s => s.id === guestModalShopId);

  const getReservationsByTime = (shop: any) => {
    const grouped: any = {};
    Object.keys(shop.slots || {}).sort().forEach(time => { grouped[time] = []; });
    shop.reservations?.forEach((res: any) => { if (grouped[res.time]) grouped[res.time].push(res); });
    return grouped;
  };

  const getQueueList = (shop: any) => {
    if (!shop.queue) return { active: [], history: [] };
    const active = shop.queue.filter((t: any) => ['waiting', 'ready'].includes(t.status));
    active.sort((a: any, b: any) => {
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (a.status !== 'ready' && b.status === 'ready') return 1;
      return (a.ticketId || "0").localeCompare(b.ticketId || "0");
    });
    return { active, history: shop.queue.filter((t: any) => ['completed', 'canceled'].includes(t.status)) };
  };

  const checkReleaseStatus = (slotTime: string, releaseBeforeTime?: string) => {
    if (!releaseBeforeTime || releaseBeforeTime === "00:00") return { isReleased: true, releaseTimeStr: "" };
    const [slotH, slotM] = slotTime.split(":").map(Number);
    const [relH, relM] = releaseBeforeTime.split(":").map(Number);
    const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotH, slotM, 0);
    const releaseDate = new Date(slotDate.getTime() - (relH * 60 + relM) * 60000);
    return {
      isReleased: now >= releaseDate,
      releaseTimeStr: `${String(releaseDate.getHours()).padStart(2, '0')}:${String(releaseDate.getMinutes()).padStart(2, '0')} 解放`,
    };
  };

  const getAvailableTimeSlots = (shop: any): string[] => {
    if (!shop?.slots) return [];
    return Object.keys(shop.slots).sort().filter(time => (shop.slots[time] ?? 0) < shop.capacity);
  };

  // ════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">

      {/* ── ユーザーIDバー ── */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="text-xs text-gray-400">Logged in as:</div>
        <div className="font-mono font-bold text-yellow-400 text-lg tracking-wider">{myUserId || "---"}</div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-32">

        {/* ── ヘッダー ── */}
        <div className="mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-bold text-white mb-4">
            予約管理 <span className="text-red-400 text-sm font-normal ml-2">生徒会・実行委員用 (Full Access)</span>
          </h1>

          {/* ── 編集フォーム ── */}
          {isEditing ? (
            <div className="bg-gray-800 rounded-lg p-4 border border-blue-500 mb-4 animate-fade-in shadow-lg shadow-blue-900/20">
              <h3 className="text-sm font-bold mb-4 text-blue-300 flex items-center gap-2 border-b border-gray-700 pb-2">
                <span>✏️ 設定編集モード</span>
                <span className="text-gray-500 text-xs font-normal ml-auto">ID: {originalId}</span>
              </h3>

              {/* ID / Pass */}
              <div className="grid gap-4 md:grid-cols-3 mb-4 bg-gray-900/50 p-3 rounded border border-gray-700">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">会場ID <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-400">(3文字)</span></label>
                  <input
                    className={`bg-gray-700 p-2 rounded text-white border focus:outline-none font-mono ${manualId !== originalId ? 'border-yellow-500' : 'border-gray-600'}`}
                    maxLength={3} value={manualId} onChange={e => setManualId(e.target.value)}
                  />
                  {manualId !== originalId && <p className="text-[10px] text-yellow-400 mt-1">⚠️ IDが変更されています</p>}
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">会場名 <span className="text-red-500 text-[10px] border border-red-500/50 px-1 rounded ml-1">必須</span></label>
                  <input className="bg-gray-700 p-2 rounded text-white border border-gray-600 focus:border-blue-500 outline-none" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">Pass <span className="text-red-500 text-[10px] border border-red-500/50 px-1 rounded ml-1">5桁</span></label>
                  <input className="bg-gray-700 p-2 rounded text-white border border-gray-600 focus:border-blue-500 outline-none font-mono" maxLength={5} value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>

              {/* 団体名 / 画像URL */}
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">団体名・クラス <span className="text-gray-500 text-[10px] border border-gray-600 px-1 rounded ml-1">任意</span></label>
                  <input className="bg-gray-700 p-2 rounded text-white border border-gray-600 focus:border-blue-500 outline-none" placeholder="例: 3年B組" value={department} onChange={e => setDepartment(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">画像URL <span className="text-gray-500 text-[10px] border border-gray-600 px-1 rounded ml-1">任意</span></label>
                  <input className="bg-gray-700 p-2 rounded text-white border border-gray-600 focus:border-blue-500 outline-none" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(convertGoogleDriveLink(e.target.value))} />
                </div>
              </div>

              {/* 説明文 */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">会場説明文 <span className="text-gray-500 text-[10px] border border-gray-600 px-1 rounded ml-1">任意・最大500文字</span></label>
                <textarea className="w-full bg-gray-700 p-2 rounded text-white h-24 text-sm border border-gray-600 focus:border-blue-500 outline-none resize-none" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} />
                <div className="text-right text-xs text-gray-500">{description.length}/500</div>
              </div>

              {/* 運用モード */}
              <div className="bg-gray-900/30 p-3 rounded border border-gray-600 mb-4">
                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Operation Mode</h4>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded border border-gray-700">
                    <span className={`text-xs font-bold ${!isQueueMode ? "text-blue-400" : "text-gray-500"}`}>🕒 時間予約制</span>
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input type="checkbox" id="mode-toggle" checked={isQueueMode} onChange={e => setIsQueueMode(e.target.checked)}
                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                        style={{ transform: isQueueMode ? 'translateX(100%)' : 'translateX(0)' }} />
                      <label htmlFor="mode-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${isQueueMode ? "bg-green-600" : "bg-gray-600"}`} />
                    </div>
                    <span className={`text-xs font-bold ${isQueueMode ? "text-green-400" : "text-gray-500"}`}>🔢 順番待ち制</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded border border-gray-700">
                    <input type="checkbox" checked={isPaused} onChange={e => setIsPaused(e.target.checked)} className="accent-red-500 w-4 h-4 cursor-pointer" />
                    <span className={`text-xs font-bold ${isPaused ? "text-red-400" : "text-gray-400"}`}>⛔ 受付を緊急停止</span>
                  </div>
                </div>
              </div>

              {/* 時間設定 */}
              {!isQueueMode && (
                <div className="bg-gray-900/30 p-3 rounded border border-gray-600 mb-4">
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Time Settings (予約制のみ)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex flex-col"><label className="text-[10px] text-gray-400 mb-1">開始時間 <span className="text-red-500">*</span></label><input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 focus:border-blue-500" /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-gray-400 mb-1">終了時間 <span className="text-red-500">*</span></label><input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 focus:border-blue-500" /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-gray-400 mb-1">1枠(分) <span className="text-red-500">*</span></label><input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 focus:border-blue-500" /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-gray-400 mb-1">定員(組) <span className="text-red-500">*</span></label><input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 focus:border-blue-500" /></div>
                    <div className="flex flex-col"><label className="text-[10px] text-yellow-400 mb-1">解放制限(前) <span className="text-[8px] bg-gray-700 px-1 rounded text-gray-400">任意</span></label><input type="time" value={releaseBeforeTime} onChange={e => setReleaseBeforeTime(e.target.value)} className="bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 focus:border-blue-500 text-yellow-100" /></div>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2">※解放制限：指定時間前になるまで予約枠をグレーアウトします。「00:00」で制限なし。</div>
                </div>
              )}

              {/* 人数 */}
              <div className="bg-gray-900/30 p-3 rounded border border-gray-600 mb-4">
                <label className="text-[10px] text-gray-400 mb-1 block">1組の最大人数</label>
                <input type="number" value={groupLimit} onChange={e => setGroupLimit(Number(e.target.value))} className="w-20 bg-gray-700 p-2 rounded text-sm outline-none text-center border border-gray-600 focus:border-blue-500" />
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3 rounded font-bold transition shadow-lg shadow-blue-900/40">変更を保存</button>
                <button onClick={resetForm} className="bg-gray-700 hover:bg-gray-600 px-6 rounded text-sm transition border border-gray-600">キャンセル</button>
              </div>
            </div>
          ) : (
            /* 新規作成フォーム（details開閉） */
            <details className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
              <summary className="cursor-pointer font-bold text-blue-400 select-none">➕ 新規会場の作成</summary>
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <div><label className="text-xs text-gray-400 block mb-1">会場ID (3文字)</label><input className="w-full p-2 rounded text-white bg-gray-700 border border-gray-600 outline-none font-mono" placeholder="例: 3B" maxLength={3} value={manualId} onChange={e => setManualId(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-400 block mb-1">会場名</label><input className="w-full bg-gray-700 p-2 rounded text-white border border-gray-600 outline-none" value={newName} onChange={e => setNewName(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-400 block mb-1">Pass (5桁)</label><input className="w-full bg-gray-700 p-2 rounded text-white border border-gray-600 outline-none font-mono" maxLength={5} value={password} onChange={e => setPassword(e.target.value)} /></div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div><label className="text-xs text-gray-400 block mb-1">団体名・クラス</label><input className="w-full bg-gray-700 p-2 rounded text-white border border-gray-600 outline-none" placeholder="例: 3年B組" value={department} onChange={e => setDepartment(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-400 block mb-1">画像URL</label><input className="w-full bg-gray-700 p-2 rounded text-white border border-gray-600 outline-none" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(convertGoogleDriveLink(e.target.value))} /></div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">会場説明文 <span className="text-gray-500 text-[10px]">任意・最大500文字</span></label>
                  <textarea className="w-full bg-gray-700 p-2 rounded text-white h-20 text-sm border border-gray-600 outline-none resize-none" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} />
                  <div className="text-right text-xs text-gray-500">{description.length}/500</div>
                </div>

                {/* 運用モード (新規) */}
                <div className="bg-gray-900 p-3 rounded border border-gray-600">
                  <label className="text-xs text-gray-400 mb-2 block font-bold">運用モード</label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 cursor-pointer p-2 rounded w-1/2 justify-center border text-sm font-bold ${!isQueueMode ? 'bg-blue-900 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                      <input type="radio" name="mode" checked={!isQueueMode} onChange={() => setIsQueueMode(false)} className="hidden" />🕒 時間予約制
                    </label>
                    <label className={`flex items-center gap-2 cursor-pointer p-2 rounded w-1/2 justify-center border text-sm font-bold ${isQueueMode ? 'bg-green-900 border-green-500 text-green-200' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                      <input type="radio" name="mode" checked={isQueueMode} onChange={() => setIsQueueMode(true)} className="hidden" />🔢 順番待ち制
                    </label>
                  </div>
                </div>

                {/* 時間設定 (新規) */}
                <div className="bg-gray-900 p-3 rounded border border-gray-600">
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">Time Settings</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div><label className="text-[10px] text-gray-400 block mb-1">開始時間</label><input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="w-full bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600" /></div>
                    <div><label className="text-[10px] text-gray-400 block mb-1">終了時間</label><input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="w-full bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600" /></div>
                    <div><label className="text-[10px] text-gray-400 block mb-1">1枠(分)</label><input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600" /></div>
                    <div><label className="text-[10px] text-gray-400 block mb-1">定員(組)</label><input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600" /></div>
                    <div><label className="text-[10px] text-yellow-400 block mb-1">解放制限(前)</label><input type="time" value={releaseBeforeTime} onChange={e => setReleaseBeforeTime(e.target.value)} className="w-full bg-gray-700 p-2 rounded text-sm outline-none border border-gray-600 text-yellow-100" /></div>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-gray-900 p-3 rounded border border-gray-600">
                  <div><label className="text-[10px] text-gray-400 block mb-1">1組の最大人数</label><input type="number" value={groupLimit} onChange={e => setGroupLimit(Number(e.target.value))} className="w-20 bg-gray-700 p-2 rounded text-sm outline-none text-center border border-gray-600" /></div>
                  <label className="ml-auto cursor-pointer text-sm text-red-300 font-bold flex items-center gap-2 bg-red-900/30 px-4 py-2 rounded border border-red-800">
                    <input type="checkbox" checked={isPaused} onChange={e => setIsPaused(e.target.checked)} className="w-4 h-4" /> 🚫 受付を停止する
                  </label>
                </div>

                <button onClick={handleSave} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 py-3 rounded font-bold transition shadow-lg shadow-blue-900/40">会場を作成</button>
              </div>
            </details>
          )}

          {/* ── 検索バー ── */}
          <div className="flex gap-2 items-center bg-gray-800 p-2 rounded border border-gray-600 mb-4">
            <span className="text-xl">🔍</span>
            <input className="flex-1 bg-transparent text-white outline-none" placeholder="ユーザーIDまたはチケットID(6桁)を入力" value={searchUserId} onChange={e => setSearchUserId(e.target.value)} />
            {searchUserId && <div className="text-xs text-pink-400 font-bold animate-pulse">※該当チケットをハイライトします</div>}
          </div>

          {/* ── ダッシュボード ── */}
          <div className="bg-black border border-gray-700 rounded-xl p-4 shadow-xl">
            <h2 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Dashboard & Global Actions</h2>
            <div className="flex justify-between items-center mb-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
              <div className="text-center"><div className="text-xs text-gray-500 mb-1">TOTAL VENUES</div><div className="text-3xl font-mono font-bold text-white tracking-widest">{stats.totalVenues}</div></div>
              <div className="text-center border-l border-r border-gray-700 px-6"><div className="text-xs text-gray-500 mb-1">PAUSED</div><div className="text-3xl font-mono font-bold text-red-500 tracking-widest">{stats.pausedVenues}</div></div>
              <div className="text-center"><div className="text-xs text-gray-500 mb-1">ACTIVE GUESTS</div><div className="text-3xl font-mono font-bold text-green-500 tracking-widest">{stats.totalReservations}</div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button onClick={() => handleBulkPause(true)} className="bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 py-2 rounded text-xs font-bold transition">🛑 一斉停止</button>
              <button onClick={() => handleBulkPause(false)} className="bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-800 py-2 rounded text-xs font-bold transition">▶️ 一斉再開</button>
              <button onClick={handleBulkDeleteReservations} className="bg-orange-900/50 hover:bg-orange-800 text-orange-200 border border-orange-800 py-2 rounded text-xs font-bold transition">🗑️ データ全削除</button>
              {/* ★変更: 全UID・会場削除ボタン */}
              <button
                onClick={() => setShowDestroyModal(true)}
                className="bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-200 border border-gray-700 hover:border-red-700 py-2 rounded text-xs font-bold transition"
              >
                💀 全UID・会場削除
              </button>
            </div>
          </div>
        </div>

        {/* ── 一覧モード ── */}
        {!expandedShopId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attractions.map(shop => {
              const hitInRes = shop.reservations?.some((r: any) => r.userId?.includes(searchUserId.toUpperCase()));
              const hitInQueue = shop.queue?.some((q: any) => q.userId?.includes(searchUserId.toUpperCase()) || q.ticketId?.includes(searchUserId.toUpperCase()));
              const hasUser = searchUserId && (hitInRes || hitInQueue);
              const totalCount = shop.isQueueMode
                ? (shop.queue?.filter((t: any) => ['waiting', 'ready'].includes(t.status)).length || 0)
                : (shop.reservations?.length || 0);

              return (
                <button
                  key={shop.id}
                  onClick={() => setExpandedShopId(shop.id)}
                  className={`group p-4 rounded-xl border text-left flex items-start gap-4 transition hover:bg-gray-800 relative overflow-hidden
                    ${hasUser ? 'bg-pink-900/40 border-pink-500' : 'bg-gray-800 border-gray-600'}`}
                >
                  {shop.imageUrl
                    ? <img src={shop.imageUrl} alt="" className="w-16 h-16 rounded object-cover bg-gray-700 flex-shrink-0" />
                    : <div className="w-16 h-16 rounded bg-gray-700 flex items-center justify-center text-2xl flex-shrink-0">🎪</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-yellow-400 font-bold font-mono text-xl">{shop.id}</span>
                      {shop.department && <span className="text-xs bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded border border-blue-800/50 truncate max-w-[100px]">{shop.department}</span>}
                      {shop.isQueueMode
                        ? <span className="text-xs bg-green-900/60 text-green-300 border border-green-700 px-2 py-0.5 rounded">🔢 順番待ち</span>
                        : <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700 px-2 py-0.5 rounded">🕒 時間予約</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg truncate">{shop.name}</span>
                      {shop.isPaused && <span className="text-xs bg-red-600 px-2 py-0.5 rounded text-white whitespace-nowrap">停止中</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {shop.isQueueMode ? `待機: ${totalCount}組` : `予約: ${totalCount}件`}
                    </div>
                  </div>
                  <div className="self-center text-gray-400 text-2xl group-hover:text-white transition-transform group-hover:translate-x-1">›</div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── 詳細モード ── */}
        {expandedShopId && targetShop && (
          <div className="animate-fade-in">
            <button onClick={() => { setExpandedShopId(null); setIsEditing(false); }} className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white">← 会場一覧に戻る</button>

            <div className="bg-gray-800 rounded-xl border border-gray-600 overflow-hidden">
              {/* タイトルバー */}
              <div className="bg-gray-700 p-4 flex justify-between items-start relative overflow-hidden">
                {targetShop.imageUrl && (
                  <div className="absolute inset-0 z-0 opacity-20">
                    <img src={targetShop.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                )}
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-400 font-mono font-bold text-xl">{targetShop.id}</span>
                    {targetShop.department && <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded backdrop-blur-sm border border-white/20">{targetShop.department}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded border backdrop-blur-sm ${targetShop.isQueueMode ? "bg-green-600/50 border-green-400 text-white" : "bg-blue-600/50 border-blue-400 text-white"}`}>
                      {targetShop.isQueueMode ? "順番待ち制" : "時間予約制"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-md">{targetShop.name}</h2>
                  <p className="text-xs text-gray-300 mt-1 drop-shadow-md">Pass: {targetShop.password} | 定員: {targetShop.capacity}組</p>
                </div>
                <div className="flex gap-2 relative z-10">
                  <button onClick={() => startEdit(targetShop)} className="bg-blue-600 text-xs px-3 py-2 rounded hover:bg-blue-500 font-bold shadow-lg">⚙️ 設定編集</button>
                  <button onClick={() => handleDeleteVenue(targetShop.id)} className="bg-red-600 text-xs px-3 py-2 rounded hover:bg-red-500 shadow-lg">削除</button>
                </div>
              </div>

              <div className="p-4 space-y-6">
                {/* 説明文 */}
                {targetShop.description && (
                  <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{targetShop.description}</div>
                )}

                {/* ゲスト枠ボタン */}
                <div className="flex justify-end">
                  <button onClick={() => openGuestModal(targetShop)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-2 rounded-lg font-bold shadow-md transition">
                    <span>👤</span><span>ゲスト枠を追加</span>
                  </button>
                </div>

                {/* 順番待ち制 */}
                {targetShop.isQueueMode ? (
                  <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="bg-gray-700 px-4 py-2 border-b border-gray-600 flex items-center justify-between">
                      <h3 className="font-bold text-green-400 flex items-center gap-2">
                        <span>📋 待機列リスト</span>
                        <span className="text-xs text-white bg-gray-600 px-2 py-0.5 rounded-full">{getQueueList(targetShop).active.length}組待ち</span>
                      </h3>
                    </div>
                    {getQueueList(targetShop).active.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">現在の待機列はありません</div>
                    ) : (
                      <div className="divide-y divide-gray-700">
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-400 font-bold bg-gray-800">
                          <div className="col-span-1">No.</div>
                          <div className="col-span-3">Ticket / User</div>
                          <div className="col-span-2 text-center">人数</div>
                          <div className="col-span-2 text-center">Status</div>
                          <div className="col-span-4 text-center">Action</div>
                        </div>
                        {getQueueList(targetShop).active.map((ticket: any, index: number) => {
                          const isMatch = searchUserId && (ticket.ticketId?.includes(searchUserId.toUpperCase()) || ticket.userId?.includes(searchUserId.toUpperCase()));
                          const isCalled = ticket.status === "ready";
                          return (
                            <div key={ticket.ticketId || ticket.userId} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-800/50 transition ${isMatch ? 'bg-pink-900/20 ring-1 ring-pink-500' : ''}`}>
                              <div className="col-span-1 text-lg font-bold text-gray-500 font-mono">{index + 1}</div>
                              <div className="col-span-3">
                                <div className="text-lg font-bold text-yellow-400 font-mono tracking-wider flex items-center gap-1">
                                  {ticket.ticketId || ticket.userId}
                                  {ticket.isGuest && <span className="text-[9px] bg-amber-700 text-amber-200 px-1 rounded">G</span>}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">UID: {ticket.userId}</div>
                              </div>
                              <div className="col-span-2 text-center"><span className="bg-gray-700 px-2 py-1 rounded text-sm font-bold text-white">{ticket.count || 1}名</span></div>
                              <div className="col-span-2 text-center">
                                {isCalled
                                  ? <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold animate-pulse">呼び出し中</span>
                                  : <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">待機中</span>}
                              </div>
                              <div className="col-span-4 flex justify-end gap-1">
                                {!isCalled && <button onClick={() => updateQueueStatus(targetShop, ticket, 'ready')} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1.5 rounded font-bold shadow-sm">Call</button>}
                                <button onClick={() => updateQueueStatus(targetShop, ticket, 'completed')} className="bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1.5 rounded font-bold shadow-sm">入場</button>
                                <button onClick={() => updateQueueStatus(targetShop, ticket, 'canceled')} className="bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white text-xs px-2 py-1.5 rounded transition">×</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 時間予約制 */
                  <div className="space-y-6">
                    {Object.entries(getReservationsByTime(targetShop)).map(([time, resList]: any) => {
                      const slotCount = targetShop.slots[time] || 0;
                      const isFull = slotCount >= targetShop.capacity;
                      const { isReleased, releaseTimeStr } = checkReleaseStatus(time, targetShop.releaseBeforeTime);

                      return (
                        <div key={time} className={`border rounded-lg p-3 transition ${isFull ? 'border-red-500/50 bg-red-900/10' : 'border-gray-600 bg-gray-900/50'} ${!isReleased ? 'opacity-60' : ''}`}>
                          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                            <div className="flex items-center gap-3">
                              <h3 className={`font-bold text-lg ${isReleased ? 'text-blue-300' : 'text-gray-500'}`}>{time}</h3>
                              {!isReleased && <span className="bg-gray-800 border border-gray-600 text-gray-400 text-[10px] px-2 py-0.5 rounded font-bold">🔒 {releaseTimeStr}</span>}
                            </div>
                            <span className={`text-sm font-bold ${isFull ? 'text-red-400' : 'text-green-400'}`}>予約: {slotCount} / {targetShop.capacity}</span>
                          </div>
                          <div className="space-y-2">
                            {resList.length === 0 && <p className="text-xs text-gray-500 text-center py-1">予約なし</p>}
                            {resList.map((res: any) => {
                              const isMatch = searchUserId && res.userId?.includes(searchUserId.toUpperCase());
                              return (
                                <div key={res.timestamp} className={`flex justify-between items-center p-2 rounded ${res.status === 'used' ? 'bg-gray-800 opacity-60' : 'bg-gray-700'} ${isMatch ? 'ring-2 ring-pink-500' : ''}`}>
                                  <div>
                                    <div className="font-mono font-bold text-yellow-400 flex items-center gap-1">
                                      ID: {res.userId}
                                      {res.isGuest && <span className="text-[9px] bg-amber-700 text-amber-200 px-1 rounded">GUEST</span>}
                                      <span className="ml-1 text-sm text-white font-normal bg-gray-600 px-2 py-0.5 rounded-full">{res.count || 1}名</span>
                                    </div>
                                    <div className="text-xs text-gray-300 mt-1">{res.status === 'used' ? '✅ 入場済' : '🔵 予約中'}</div>
                                  </div>
                                  <div className="flex gap-1">
                                    {res.status !== 'used'
                                      ? <><button onClick={() => toggleReservationStatus(targetShop, res, "used")} className="bg-green-600 text-xs px-3 py-1.5 rounded font-bold hover:bg-green-500">入場</button><button onClick={() => cancelReservation(targetShop, res)} className="bg-red-600 text-xs px-3 py-1.5 rounded hover:bg-red-500">取消</button></>
                                      : <button onClick={() => toggleReservationStatus(targetShop, res, "reserved")} className="bg-gray-600 text-xs px-3 py-1.5 rounded hover:bg-gray-500">戻す</button>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ゲスト枠追加モーダル ── */}
      {guestModalShopId && guestModalShop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl border border-amber-500/50 shadow-2xl shadow-amber-900/30 w-full max-w-sm p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-xl flex-shrink-0">👤</div>
              <div>
                <h2 className="text-lg font-bold text-white">ゲスト枠を追加</h2>
                <p className="text-xs text-amber-400 font-mono">{guestModalShop.name}</p>
              </div>
            </div>

            <div className="bg-gray-900/70 border border-gray-600 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
              <span className="text-xs text-gray-400">割り当てられるGuest ID</span>
              <span className="text-lg font-bold text-amber-400 font-mono tracking-widest">{generateGuestId(guestModalShop)}</span>
            </div>

            {!guestModalShop.isQueueMode && (
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block">予約する時間枠を選択 <span className="text-red-500">*</span></label>
                <select value={guestSelectedTime} onChange={e => setGuestSelectedTime(e.target.value)} className="w-full bg-gray-700 border border-gray-500 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">-- 時間を選択 --</option>
                  {getAvailableTimeSlots(guestModalShop).map(time => {
                    const remaining = guestModalShop.capacity - (guestModalShop.slots?.[time] ?? 0);
                    return <option key={time} value={time}>{time}（残り {remaining} 枠）</option>;
                  })}
                </select>
                {getAvailableTimeSlots(guestModalShop).length === 0 && <p className="text-xs text-red-400 mt-1">予約可能な時間枠がありません</p>}
              </div>
            )}

            {guestModalShop.isQueueMode && (
              <div className="mb-4 bg-green-900/20 border border-green-700/50 rounded-lg px-4 py-3 text-xs text-green-300">
                待機列の最後尾（現在 {guestModalShop.queue?.length || 0}組目）に追加されます
              </div>
            )}

            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-2 block">人数</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setGuestCount(c => Math.max(1, c - 1))} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg flex items-center justify-center transition">−</button>
                <span className="flex-1 text-center text-2xl font-bold text-white font-mono">{guestCount}<span className="text-sm text-gray-400 ml-1">名</span></span>
                <button onClick={() => setGuestCount(c => Math.min(guestModalShop.groupLimit || 10, c + 1))} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg flex items-center justify-center transition">＋</button>
              </div>
              <p className="text-[10px] text-gray-500 text-center mt-1">最大 {guestModalShop.groupLimit || 10}名</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setGuestModalShopId(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg text-sm transition border border-gray-600">キャンセル</button>
              <button onClick={handleAddGuestSlot} disabled={!guestModalShop.isQueueMode && !guestSelectedTime} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-bold transition shadow-lg">追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 全削除確認モーダル ── */}
      {showDestroyModal && (
        <DestroyModal
          onConfirm={handleBulkDestroyAll}
          onCancel={() => setShowDestroyModal(false)}
        />
      )}
    </div>
  );
}
