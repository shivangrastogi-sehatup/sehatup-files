import { useState } from "react";
import { isFirebaseConfigured } from "./firebase";
import { COUNTRY_CODE, BUSINESS_WHATSAPP } from "./config";

export default function SetupScreen({ onOpen }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");

  const onDigits = (e) => {
    // numbers only, max 10 — the +91 prefix is fixed and not part of this field
    setDigits(e.target.value.replace(/\D/g, "").slice(0, 10));
  };

  const submit = () => {
    if (digits.length !== 10) return setError("Enter your 10-digit WhatsApp number");
    setError("");
    onOpen({ digits });
  };

  return (
    <section className="screen setup">
      <div className="setup-inner">
        <div className="brand">
          <div className="logo">💬</div>
          <div>
            <h1>QuickReply Tester</h1>
            <p>Chat with the bot on real WhatsApp</p>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="note config-warn">
            <span>⚠️</span>
            <span>
              <b>Firebase not configured.</b> Add your keys to <b>.env</b> to detect
              the bridge and see live replies.
            </span>
          </div>
        )}

        <div className="card">
          <h2>Connect on WhatsApp</h2>

          <div className="field">
            <label>Your WhatsApp number</label>
            <div className="phone-input">
              <span className="cc">+{COUNTRY_CODE}</span>
              <input
                value={digits}
                onChange={onDigits}
                placeholder="9354049041"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="hint">
              We only use this to watch <b>your</b> conversation
              (<code>qr_conversations/{COUNTRY_CODE}{digits || "…"}</code>) and detect
              when the bridge connects.
            </div>
          </div>

          {error && <div className="err-line">{error}</div>}

          <button className="btn-primary" onClick={submit}>
            <span>💬</span><span>Open WhatsApp &amp; Say Hi</span>
          </button>

          <div className="hint" style={{ marginTop: 10 }}>
            This opens WhatsApp to <b>+{BUSINESS_WHATSAPP}</b> with “Hi” ready to send.
            Sending it opens the 24-hour window and starts the bot flow.
          </div>
        </div>

        <div className="note">
          <span>⏱️</span>
          <span>
            After you say hi, the bot <b>batches messages and waits ~3 minutes</b>
            before replying (per your n8n flow) — that delay is expected.
          </span>
        </div>
      </div>
    </section>
  );
}
