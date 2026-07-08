// #呼び出し番号表示画面 (app/signage/page.tsx)
"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../../firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

// ─────────────────────────────────────────
//  型
// ─────────────────────────────────────────
type Ticket = {
  ticketId: string;
  userId: string;
  count: number;
  status: "waiting" | "ready";
  isGuest?: boolean;
};

type Shop = {
  id: string;
  name: string;
  department?: string;
  isQueueMode: boolean;
  queue?: Ticket[];
};

// ─────────────────────────────────────────
//  定数
// ─────────────────────────────────────────
const BLINK_INTERVAL = 800; // ms

// ─────────────────────────────────────────
//  会場選択画面
// ─────────────────────────────────────────
function ShopSelectScreen({
  shops,
  onSelect,
}: {
  shops: Shop[];
  onSelect: (shop: Shop) => void;
}) {
  const queueShops = shops.filter((s) => s.isQueueMode);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
      }}
    >
      {/* タイトル */}
      <div
        style={{
          marginBottom: "3rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            letterSpacing: "0.3em",
            color: "#555",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}
        >
          Digital Signage System
        </div>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "0.05em",
          }}
        >
          会場を選択してください
        </h1>
      </div>

      {/* 会場リスト */}
      {queueShops.length === 0 ? (
        <div
          style={{
            color: "#555",
            fontSize: "1rem",
            border: "1px dashed #333",
            borderRadius: "12px",
            padding: "2rem 3rem",
            textAlign: "center",
          }}
        >
          順番待ち制の会場が見つかりません
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
            width: "100%",
            maxWidth: "860px",
          }}
        >
          {queueShops.map((shop) => {
            const calledCount =
              shop.queue?.filter((t) => t.status === "ready").length ?? 0;
            const waitingCount =
              shop.queue?.filter((t) => t.status === "waiting").length ?? 0;

            return (
              <button
                key={shop.id}
                onClick={() => onSelect(shop)}
                style={{
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "16px",
                  padding: "1.5rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.18s ease",
                  color: "#fff",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#1a1a1a";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#FFD700";
                  (
                    e.currentTarget as HTMLButtonElement
                  ).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#111";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#2a2a2a";
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "translateY(0)";
                }}
              >
                {/* ID バッジ */}
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: "monospace",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    background: "#FFD700",
                    color: "#000",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    marginBottom: "0.6rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  {shop.id}
                </div>

                {/* 会場名 */}
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    marginBottom: "0.25rem",
                    lineHeight: 1.3,
                  }}
                >
                  {shop.name}
                </div>

                {/* 団体名 */}
                {shop.department && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#666",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {shop.department}
                  </div>
                )}

                {/* カウント */}
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginTop: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid #222",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: calledCount > 0 ? "#ff4d4d" : "#555",
                        lineHeight: 1,
                      }}
                    >
                      {calledCount}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "#555", marginTop: "2px" }}>
                      呼び出し中
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: "#aaa",
                        lineHeight: 1,
                      }}
                    >
                      {waitingCount}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "#555", marginTop: "2px" }}>
                      待機中
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  呼び出し番号表示画面 (16:9 固定)
// ─────────────────────────────────────────
function SignageScreen({
  shop,
  onBack,
}: {
  shop: Shop;
  onBack: () => void;
}) {
  const [blinkOn, setBlinkOn] = useState(true);
  const [clock, setClock] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 呼び出し中 / 準備中 に分類
  const calledTickets = (shop.queue ?? []).filter((t) => t.status === "ready");
  const waitingTickets = (shop.queue ?? []).filter((t) => t.status === "waiting");

  // ブリンク
  useEffect(() => {
    const t = setInterval(() => setBlinkOn((b) => !b), BLINK_INTERVAL);
    return () => clearInterval(t);
  }, []);

  // 時計
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setClock(`${hh}:${mm}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // 16:9 スケール計算
  useEffect(() => {
    const BASE_W = 1920;
    const BASE_H = 1080;
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleW = vw / BASE_W;
      const scaleH = vh / BASE_H;
      setScale(Math.min(scaleW, scaleH));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 表示ラベル（ticketId を優先、なければ userId）
  const labelOf = (t: Ticket) => t.ticketId || t.userId;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
      }}
    >
      {/* スケールコンテナ (1920×1080 基準) */}
      <div
        ref={containerRef}
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          display: "flex",
          flexDirection: "column",
          background: "#050505",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── 背景グリッドライン（装飾） ── */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.04,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 96}
              y1={0}
              x2={i * 96}
              y2={1080}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * 90}
              x2={1920}
              y2={i * 90}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </svg>

        {/* ── ヘッダーバー ── */}
        <div
          style={{
            height: 88,
            background: "#0d0d0d",
            borderBottom: "2px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 60px",
            flexShrink: 0,
          }}
        >
          {/* 戻るボタン */}
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#555",
              fontSize: 22,
              padding: "6px 20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#aaa";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#666";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#555";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#333";
            }}
          >
            ← 戻る
          </button>

          {/* 会場名 */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              {shop.name}
            </div>
            {shop.department && (
              <div style={{ fontSize: 18, color: "#555", marginTop: 4 }}>
                {shop.department}
              </div>
            )}
          </div>

          {/* 時計 */}
          <div
            style={{
              fontSize: 40,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
              color: "#333",
              letterSpacing: "0.05em",
              fontFamily: "monospace",
            }}
          >
            {clock}
          </div>
        </div>

        {/* ── メインエリア ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
          }}
        >
          {/* ════════════════════════════════
              左エリア: 準備中 (60%)
          ════════════════════════════════ */}
          <div
            style={{
              flex: "0 0 60%",
              borderRight: "2px solid #1a1a1a",
              display: "flex",
              flexDirection: "column",
              padding: "48px 60px",
              minWidth: 0,
            }}
          >
            {/* セクションラベル */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#444",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                marginBottom: 32,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#2a7de1",
                }}
              />
              準備中
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  color: "#333",
                  letterSpacing: "0.05em",
                  marginLeft: 8,
                }}
              >
                {waitingTickets.length}組
              </span>
            </div>

            {/* グリッド (2列) */}
            {waitingTickets.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#222",
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                — 待機なし —
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px 24px",
                  alignContent: "start",
                  overflow: "hidden",
                }}
              >
                {waitingTickets.map((ticket, i) => (
                  <WaitingCard key={ticket.ticketId} ticket={ticket} index={i} label={labelOf(ticket)} />
                ))}
              </div>
            )}
          </div>

          {/* ════════════════════════════════
              右エリア: 呼び出し中 (40%)
          ════════════════════════════════ */}
          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              padding: "48px 56px",
              minWidth: 0,
              background: calledTickets.length > 0 ? "#060606" : "transparent",
              position: "relative",
            }}
          >
            {/* 呼び出し中のとき背景パルス */}
            {calledTickets.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse at 50% 30%, rgba(255,60,60,0.06) 0%, transparent 70%)",
                  pointerEvents: "none",
                  transition: `opacity ${BLINK_INTERVAL}ms ease`,
                  opacity: blinkOn ? 1 : 0,
                }}
              />
            )}

            {/* セクションラベル */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                marginBottom: 40,
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: calledTickets.length > 0 ? "#ff4d4d" : "#444",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background:
                    calledTickets.length > 0
                      ? blinkOn
                        ? "#ff4d4d"
                        : "#400"
                      : "#333",
                  transition: `background ${BLINK_INTERVAL}ms ease`,
                }}
              />
              呼び出し中
              {calledTickets.length > 0 && (
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    color: "#ff4d4d",
                    letterSpacing: "0.05em",
                    marginLeft: 8,
                    opacity: 0.7,
                  }}
                >
                  {calledTickets.length}組
                </span>
              )}
            </div>

            {/* 呼び出しリスト */}
            {calledTickets.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1e1e1e",
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                — 呼び出しなし —
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 28,
                  overflow: "hidden",
                }}
              >
                {calledTickets.map((ticket) => (
                  <CalledCard
                    key={ticket.ticketId}
                    ticket={ticket}
                    blinkOn={blinkOn}
                    label={labelOf(ticket)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── フッター ── */}
        <div
          style={{
            height: 48,
            background: "#0a0a0a",
            borderTop: "1px solid #111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, color: "#2a2a2a", letterSpacing: "0.2em" }}>
            QUEUE DISPLAY SYSTEM
          </div>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#1a1a1a",
            }}
          />
          <div style={{ fontSize: 16, color: "#2a2a2a", fontFamily: "monospace" }}>
            {shop.id}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  準備中カード
// ─────────────────────────────────────────
function WaitingCard({
  ticket,
  index,
  label,
}: {
  ticket: Ticket;
  index: number;
  label: string;
}) {
  return (
    <div
      style={{
        background: "#0f0f0f",
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: "24px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minWidth: 0,
      }}
    >
      {/* 順番 */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          color: "#2a2a2a",
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
          width: 40,
          textAlign: "center",
        }}
      >
        {index + 1}
      </div>

      {/* ID */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          color: "#c8c8c8",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
          lineHeight: 1,
          fontFamily: "'Noto Sans JP', 'Yu Gothic', sans-serif",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      {/* 人数 */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#333",
          flexShrink: 0,
          textAlign: "right",
          lineHeight: 1.2,
        }}
      >
        {ticket.count}
        <span style={{ fontSize: 14, display: "block" }}>名</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  呼び出し中カード
// ─────────────────────────────────────────
function CalledCard({
  ticket,
  blinkOn,
  label,
}: {
  ticket: Ticket;
  blinkOn: boolean;
  label: string;
}) {
  return (
    <div
      style={{
        background: "#0a0000",
        border: `2px solid ${blinkOn ? "#cc2222" : "#400"}`,
        borderRadius: 20,
        padding: "36px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
        transition: `border-color ${BLINK_INTERVAL}ms ease`,
      }}
    >
      {/* 上部ラベル */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: blinkOn ? "#cc3333" : "#660000",
          transition: `color ${BLINK_INTERVAL}ms ease`,
          textTransform: "uppercase",
        }}
      >
        ▶ お越しください
      </div>

      {/* 大ID */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "0.04em",
          color: blinkOn ? "#FFD700" : "#aa8800",
          transition: `color ${BLINK_INTERVAL}ms ease`,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'Noto Sans JP', 'Yu Gothic', sans-serif",
          textAlign: "center",
          wordBreak: "break-all",
        }}
      >
        {label}
      </div>

      {/* 人数 */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#555",
        }}
      >
        {ticket.count}名
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  メインコンポーネント
// ─────────────────────────────────────────
export default function SignagePage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);

    const unsub = onSnapshot(collection(db, "attractions"), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shop));
      setShops(all);

      // 選択中の会場データをリアルタイム更新
      setSelectedShop((prev) => {
        if (!prev) return null;
        const updated = all.find((s) => s.id === prev.id);
        return updated ?? prev;
      });
    });

    return () => unsub();
  }, []);

  if (selectedShop) {
    return (
      <SignageScreen
        shop={selectedShop}
        onBack={() => setSelectedShop(null)}
      />
    );
  }

  return <ShopSelectScreen shops={shops} onSelect={setSelectedShop} />;
}
