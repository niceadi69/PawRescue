// Member 4 (Rhythm): donation page (demo)
// Every QR code and address on this page is a placeholder for the hackathon
// demo. The QR codes are drawn patterns that can't be scanned, and the
// addresses are deliberately invalid, so nothing here can receive money.
import { useMemo, useState } from "react";

const base = import.meta.env.BASE_URL;

const AMOUNTS = [100, 500, 1000, 2000];

const UPI_ID = "pawrescue@demo-upi";

const IMPACT = [
  {
    icon: "🚑",
    title: "Emergency vet care",
    text: "First aid, X-rays and surgery for animals hit by traffic.",
  },
  {
    icon: "💊",
    title: "Medicines and recovery",
    text: "Pain relief, antibiotics and follow-up visits while they heal.",
  },
  {
    icon: "🍲",
    title: "Food and shelter",
    text: "Meals and a clean, safe place to recover.",
  },
  {
    icon: "💉",
    title: "Vaccination and sterilisation",
    text: "Anti-rabies shots and sterilisation before adoption.",
  },
];

// Deliberately invalid: each contains characters its network never uses
const COINS = [
  {
    id: "btc",
    symbol: "₿",
    name: "Bitcoin",
    ticker: "BTC",
    network: "Bitcoin network",
    address: "bc1qdemo0pawrescue0not0a0real0address",
  },
  {
    id: "eth",
    symbol: "Ξ",
    name: "Ethereum",
    ticker: "ETH",
    network: "Ethereum (ERC-20)",
    address: "0xDEMO0PAWRESCUE0000NOT0A0REAL0ADDRESS00",
  },
  {
    id: "usdt",
    symbol: "₮",
    name: "Tether",
    ticker: "USDT",
    network: "Tron (TRC-20)",
    address: "TDEMO0PAWRESCUE0NOT0A0REAL0ADDRESS",
  },
];

const rupees = (value) => `₹${value.toLocaleString("en-IN")}`;

// Seeded random numbers, so each demo QR looks different but never changes
function seeded(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws a QR-style pattern (finder squares, timing lines, random modules).
// It is NOT a real QR code: scanning it does nothing.
function demoQrPath(seed) {
  const size = 29;
  const quiet = 2;
  const random = seeded(seed);
  const dark = Array.from({ length: size }, () => Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => Array(size).fill(false));

  const square = (top, left, outer, gap) => {
    for (let r = -1; r <= outer; r++) {
      for (let c = -1; c <= outer; c++) {
        const y = top + r;
        const x = left + c;
        if (y < 0 || x < 0 || y >= size || x >= size) continue;
        fixed[y][x] = true;
        const inside = r >= 0 && c >= 0 && r < outer && c < outer;
        const mid = (outer - 1) / 2;
        const ring = Math.max(Math.abs(r - mid), Math.abs(c - mid));
        dark[y][x] = inside && ring !== gap;
      }
    }
  };

  square(0, 0, 7, 2);
  square(0, size - 7, 7, 2);
  square(size - 7, 0, 7, 2);
  square(size - 9, size - 9, 5, 1);

  for (let i = 8; i < size - 8; i++) {
    fixed[6][i] = fixed[i][6] = true;
    dark[6][i] = dark[i][6] = i % 2 === 0;
  }

  // Clear the middle for the badge
  for (let y = 11; y < 18; y++) {
    for (let x = 11; x < 18; x++) {
      fixed[y][x] = true;
      dark[y][x] = false;
    }
  }

  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = fixed[y][x] ? dark[y][x] : random() < 0.5;
      if (on) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return path;
}

function DemoQr({ seed, label, badge }) {
  const path = useMemo(() => demoQrPath(seed), [seed]);

  return (
    <div className="dn-qr">
      <svg
        viewBox="0 0 33 33"
        role="img"
        aria-label={`${label} demo QR pattern (not scannable)`}
        shapeRendering="crispEdges"
      >
        <rect width="33" height="33" fill="#FFFFFF" />
        <path d={path} fill="#2B1A12" />
      </svg>
      <span className="dn-qr-badge" aria-hidden="true">
        {badge}
      </span>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="dn-copy" onClick={copy}>
      {copied ? "Copied (demo)" : "Copy"}
    </button>
  );
}

export default function DonatePage() {
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState("");

  const customValue = Math.floor(Number(custom));
  const chosen = custom && customValue > 0 ? customValue : amount;

  return (
    <div className="m4-page dn-page">
      <header className="dn-hero">
        <nav className="dn-nav">
          <a className="m4-brand" href={`${base}index.html`}>
            🐾 Paw<span>Rescue</span>
          </a>
          <div className="dn-links">
            <a href={`${base}adopt.html`}>Adopt</a>
            <a className="dn-on" href={`${base}donate.html`} aria-current="page">
              Donate
            </a>
            <a href={`${base}report.html`}>Report cruelty</a>
          </div>
        </nav>
        <div className="dn-hero-body">
          <p className="dn-kicker">Support a rescue</p>
          <h1>Help an injured street animal get to a vet</h1>
          <p>
            Volunteers do the rescuing. Donations cover what they can't:
            emergency treatment, medicines, food and a safe place to recover.
          </p>
        </div>
      </header>

      <p className="dn-demo" role="note">
        <strong>Demo page for SatHack 2026.</strong> Every QR code and address
        below is a placeholder. Nothing here can receive money, so please don't
        try to pay.
      </p>

      <main className="dn-main">
        <div className="dn-top">
          <section className="dn-card dn-upi" aria-labelledby="dn-upi-title">
            <div className="dn-card-head">
              <h2 id="dn-upi-title">Give with UPI</h2>
              <span className="dn-tag">Demo</span>
            </div>

            <p className="dn-label">Choose an amount</p>
            <div className="dn-amounts">
              {AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    !custom && amount === value ? "dn-amount dn-amount-on" : "dn-amount"
                  }
                  onClick={() => {
                    setAmount(value);
                    setCustom("");
                  }}
                >
                  {rupees(value)}
                </button>
              ))}
              <label className={custom ? "dn-custom dn-custom-on" : "dn-custom"}>
                <span>₹</span>
                <input
                  type="number"
                  min="10"
                  inputMode="numeric"
                  placeholder="Other"
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  aria-label="Other amount in rupees"
                />
              </label>
            </div>

            <div className="dn-pay">
              <DemoQr seed="upi-pawrescue" label="UPI" badge="🐾" />
              <div className="dn-pay-info">
                <p className="dn-pay-amount">{rupees(chosen)}</p>
                <p className="dn-muted">
                  In the live version, any UPI app can scan this code.
                </p>
                <div className="dn-id">
                  <span>UPI ID</span>
                  <code>{UPI_ID}</code>
                  <CopyButton text={UPI_ID} />
                </div>
                <p className="dn-fine">Placeholder ID, not registered with any bank.</p>
              </div>
            </div>
          </section>

          <section className="dn-card dn-impact" aria-labelledby="dn-impact-title">
            <h2 id="dn-impact-title">Where your donation goes</h2>
            <ul className="dn-impact-list">
              {IMPACT.map((item) => (
                <li key={item.title}>
                  <span className="dn-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="dn-fine">
              Planned: each donation will be linked to the rescues it paid for.
            </p>
          </section>
        </div>

        <section className="dn-crypto" aria-labelledby="dn-crypto-title">
          <div className="dn-section-head">
            <h2 id="dn-crypto-title">Or give in crypto</h2>
            <p className="dn-muted">
              Representational wallets for the demo. These addresses are
              deliberately invalid.
            </p>
          </div>
          <div className="dn-coins">
            {COINS.map((coin) => (
              <article key={coin.id} className={`dn-card dn-coin dn-coin-${coin.id}`}>
                <div className="dn-coin-head">
                  <span className="dn-coin-badge" aria-hidden="true">
                    {coin.symbol}
                  </span>
                  <div>
                    <h3>{coin.name}</h3>
                    <p className="dn-muted">
                      {coin.ticker} · {coin.network}
                    </p>
                  </div>
                  <span className="dn-tag">Demo</span>
                </div>
                <DemoQr seed={coin.id} label={coin.name} badge={coin.symbol} />
                <div className="dn-addr">
                  <code>{coin.address}</code>
                  <CopyButton text={coin.address} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="dn-cta">
          <div>
            <h2>Can't donate right now?</h2>
            <p>
              Report an injured animal on the PawRescue Telegram bot, or give a
              rescued one a home.
            </p>
          </div>
          <a className="m4-button" href={`${base}adopt.html`}>
            Meet animals up for adoption
          </a>
        </section>
      </main>

      <footer className="dn-foot">
        PawRescue · SatHack 2026 demo. No payments are processed on this page.
      </footer>
    </div>
  );
}
