'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────
type TxType = 'expense' | 'income';
type Tab = 'home' | 'add' | 'analytics';

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  note: string;
  category: string;
  date: string;
}

// ─── Constants ────────────────────────────────────────────
const STORAGE_KEY = 'expense_tracker_v1';

// แก้ตรงนี้เป็น URL ของ Google Apps Script ที่ deploy ไว้
const SCRIPT_URL = '';

const EXPENSE_CATS = [
  { id: 'food',      label: 'อาหาร',    emoji: '🍜' },
  { id: 'transport', label: 'เดินทาง',  emoji: '🚌' },
  { id: 'shopping',  label: 'ช้อปปิ้ง', emoji: '🛍️' },
  { id: 'health',    label: 'สุขภาพ',   emoji: '💊' },
  { id: 'util',      label: 'ค่าน้ำไฟ', emoji: '💡' },
  { id: 'entertain', label: 'บันเทิง',  emoji: '🎮' },
  { id: 'other',     label: 'อื่นๆ',    emoji: '📦' },
];

const INCOME_CATS = [
  { id: 'salary',    label: 'เงินเดือน', emoji: '💼' },
  { id: 'freelance', label: 'ฟรีแลนซ์',  emoji: '💻' },
  { id: 'bonus',     label: 'โบนัส',     emoji: '🎁' },
  { id: 'other',     label: 'อื่นๆ',     emoji: '📦' },
];

const CAT_COLORS: Record<string, string> = {
  food: '#534AB7', transport: '#0F6E56', shopping: '#993556',
  health: '#185FA5', util: '#633806', entertain: '#712B13',
  salary: '#27500A', freelance: '#27500A', bonus: '#27500A',
  other: '#444441',
};

const CAT_BG: Record<string, string> = {
  food: '#EEEDFE', transport: '#E1F5EE', shopping: '#FBEAF0',
  health: '#E6F1FB', util: '#FAEEDA', entertain: '#FAECE7',
  salary: '#EAF3DE', freelance: '#EAF3DE', bonus: '#EAF3DE',
  other: '#F1EFE8',
};

// ─── Helpers ──────────────────────────────────────────────
function fmt(n: number) {
  return '฿' + Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function getCat(id: string) {
  return [...EXPENSE_CATS, ...INCOME_CATS].find(c => c.id === id) ?? EXPENSE_CATS[6];
}

function saveLocal(txs: Transaction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

async function syncToSheet(payload: object) {
  if (!SCRIPT_URL) return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    // ไม่มีเน็ต — ข้อมูลยังอยู่ใน localStorage
  }
}

// ─── App ──────────────────────────────────────────────────
export default function Home() {
  const [txs, setTxs]         = useState<Transaction[]>([]);
  const [tab, setTab]         = useState<Tab>('home');
  const [txType, setTxType]   = useState<TxType>('expense');
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [category, setCategory] = useState('food');
  const [syncing, setSyncing] = useState(false);

  // โหลดข้อมูล
  useEffect(() => {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) setTxs(JSON.parse(local));

    if (SCRIPT_URL) {
      setSyncing(true);
      fetch(SCRIPT_URL)
        .then(r => r.json())
        .then((data: Transaction[]) => {
          setTxs(data);
          saveLocal(data);
        })
        .catch(() => {})
        .finally(() => setSyncing(false));
    }
  }, []);

  const totalIncome  = txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  function handleAdd() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const tx: Transaction = {
      id: Date.now().toString(),
      type: txType,
      amount: amt,
      note: note.trim(),
      category,
      date: new Date().toISOString(),
    };
    const updated = [tx, ...txs];
    setTxs(updated);
    saveLocal(updated);
    syncToSheet({ action: 'add', ...tx });
    setAmount('');
    setNote('');
    setTab('home');
  }

  function handleDelete(id: string) {
    if (!confirm('ลบรายการนี้ใช่ไหม?')) return;
    const updated = txs.filter(t => t.id !== id);
    setTxs(updated);
    saveLocal(updated);
    syncToSheet({ action: 'delete', id });
  }

  function switchType(t: TxType) {
    setTxType(t);
    setCategory(t === 'income' ? 'salary' : 'food');
  }

  const cats = txType === 'income' ? INCOME_CATS : EXPENSE_CATS;

  // Analytics
  const expTxs = txs.filter(t => t.type === 'expense');
  const catTotals = expTxs.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const catSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxAmt = catSorted[0]?.[1] ?? 1;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* ── Home ─────────────────────────────────────────── */}
      {tab === 'home' && (
        <div className={styles.page}>
          <div className={styles.topbar}>
            <div>
              <div className={styles.greeting}>สวัสดี 👋</div>
              <div className={styles.dateStr}>
                {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            {syncing && <div className={styles.syncBadge}>กำลังซิงค์...</div>}
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.sumLabel}>ยอดคงเหลือ</div>
            <div className={styles.sumBalance}>{fmt(balance)}</div>
            <div className={styles.sumRow}>
              <div className={styles.sumSub}>
                <div className={styles.sumSubLabel}>↓ รายรับ</div>
                <div className={styles.sumSubVal}>{fmt(totalIncome)}</div>
              </div>
              <div className={styles.sumSub}>
                <div className={styles.sumSubLabel}>↑ รายจ่าย</div>
                <div className={styles.sumSubVal}>{fmt(totalExpense)}</div>
              </div>
            </div>
          </div>

          <div className={styles.sectionTitle}>รายการล่าสุด</div>

          {txs.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีรายการ{'\n'}กด + เพื่อเพิ่ม</div>
          ) : (
            <div className={styles.txList}>
              {txs.map(tx => {
                const cat = getCat(tx.category);
                const isExp = tx.type === 'expense';
                return (
                  <div key={tx.id} className={styles.txItem}>
                    <div
                      className={styles.txIcon}
                      style={{ background: CAT_BG[tx.category] ?? '#f0f0f0' }}
                    >
                      {cat.emoji}
                    </div>
                    <div className={styles.txInfo}>
                      <div className={styles.txName}>{tx.note || cat.label}</div>
                      <div className={styles.txMeta}>{cat.label} · {shortDate(tx.date)}</div>
                    </div>
                    <div
                      className={styles.txAmt}
                      style={{ color: isExp ? '#A32D2D' : '#0F6E56' }}
                    >
                      {isExp ? '-' : '+'}{fmt(tx.amount)}
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(tx.id)}
                      aria-label="ลบ"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add ──────────────────────────────────────────── */}
      {tab === 'add' && (
        <div className={styles.page}>
          <div className={styles.pageTitle}>เพิ่มรายการ</div>

          <div className={styles.typeRow}>
            <button
              className={`${styles.typeBtn} ${txType === 'expense' ? styles.typeBtnExp : ''}`}
              onClick={() => switchType('expense')}
            >
              ↑ รายจ่าย
            </button>
            <button
              className={`${styles.typeBtn} ${txType === 'income' ? styles.typeBtnInc : ''}`}
              onClick={() => switchType('income')}
            >
              ↓ รายรับ
            </button>
          </div>

          <label className={styles.label}>จำนวนเงิน (฿)</label>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          <label className={styles.label}>รายละเอียด</label>
          <input
            className={styles.input}
            type="text"
            placeholder="เช่น ข้าวกลางวัน, ค่าน้ำมัน"
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          <label className={styles.label}>หมวดหมู่</label>
          <div className={styles.catGrid}>
            {cats.map(c => (
              <button
                key={c.id}
                className={`${styles.catBtn} ${category === c.id ? styles.catBtnSel : ''}`}
                onClick={() => setCategory(c.id)}
              >
                <span className={styles.catEmoji}>{c.emoji}</span>
                <span className={styles.catLabel}>{c.label}</span>
              </button>
            ))}
          </div>

          <button
            className={styles.submitBtn}
            onClick={handleAdd}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            บันทึก
          </button>
        </div>
      )}

      {/* ── Analytics ────────────────────────────────────── */}
      {tab === 'analytics' && (
        <div className={styles.page}>
          <div className={styles.pageTitle}>สรุปรายจ่าย</div>

          {catSorted.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีรายจ่าย</div>
          ) : (
            <>
              <div className={styles.analyticsTotal}>{fmt(totalExpense)}</div>
              <div className={styles.analyticsTotalLabel}>รายจ่ายทั้งหมด</div>
              <div className={styles.barList}>
                {catSorted.map(([catId, amt]) => {
                  const cat = getCat(catId);
                  const pct = Math.round((amt / maxAmt) * 100);
                  return (
                    <div key={catId} className={styles.barRow}>
                      <span className={styles.barEmoji}>{cat.emoji}</span>
                      <div className={styles.barInfo}>
                        <div className={styles.barHeader}>
                          <span className={styles.barName}>{cat.label}</span>
                          <span className={styles.barAmt}>{fmt(amt)}</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{
                              width: `${pct}%`,
                              background: CAT_COLORS[catId] ?? '#888',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bottom Nav ───────────────────────────────────── */}
      <nav className={styles.bottomNav}>
        <button
          className={`${styles.navBtn} ${tab === 'home' ? styles.navActive : ''}`}
          onClick={() => setTab('home')}
        >
          <span className={styles.navIcon}>🏠</span>
          <span className={styles.navLabel}>หน้าหลัก</span>
        </button>

        <button className={styles.navAddBtn} onClick={() => setTab('add')} aria-label="เพิ่มรายการ">
          <span className={styles.navAddIcon}>+</span>
        </button>

        <button
          className={`${styles.navBtn} ${tab === 'analytics' ? styles.navActive : ''}`}
          onClick={() => setTab('analytics')}
        >
          <span className={styles.navIcon}>📊</span>
          <span className={styles.navLabel}>วิเคราะห์</span>
        </button>
      </nav>
    </div>
  );
}
