import { useState } from "react";
import { isFirebaseConfigured } from "./firebase";
import { COUNTRY_CODE } from "./config";

// Ask once for the number to watch. The choice is remembered on this device
// (localStorage, handled in App), so this screen only appears the first time or
// after Logout — never in a loop.
export default function PhoneEntry({ onSubmit }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");

  const onDigits = (e) => {
    // numbers only, max 10 — the +91 prefix is fixed and not part of this field
    setDigits(e.target.value.replace(/\D/g, "").slice(0, 10));
  };

  const submit = () => {
    if (digits.length !== 10) return setError("Enter a 10-digit WhatsApp number");
    setError("");
    onSubmit(COUNTRY_CODE + digits); // e.g. 919354049041
  };

  return (
    <section className="screen setup">
      <div className="setup-inner">
        <div className="brand">
          <div className="logo">💬</div>
          <div>
            <h1>QuickReply Tester</h1>
            <p>Watch a WhatsApp conversation live</p>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="note config-warn">
            <span>⚠️</span>
            <span>
              <b>Firebase not configured.</b> Add your keys to <b>.env</b> to see live replies.
            </span>
          </div>
        )}

        <div className="card">
          <h2>Which number to watch</h2>

          <div className="field">
            <label>WhatsApp number</label>
            <div className="phone-input">
              <span className="cc">+{COUNTRY_CODE}</span>
              <input
                value={digits}
                onChange={onDigits}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="9354049041"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="hint">
              Saved on this device, so you won't be asked again. Use <b>Logout</b> in
              the chat to switch to a different number.
            </div>
          </div>

          {error && <div className="err-line">{error}</div>}

          <button className="btn-primary" onClick={submit}>
            <span>👁️</span><span>Watch conversation</span>
          </button>
        </div>

        <div className="note">
          <span>💡</span>
          <span>
            Ask the user to message the bot on real WhatsApp. Their messages and the
            bot's replies show up here live.
          </span>
        </div>
      </div>
    </section>
  );
}
