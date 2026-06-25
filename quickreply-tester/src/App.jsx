import { useState } from "react";
import SetupScreen from "./SetupScreen.jsx";
import ChatScreen from "./ChatScreen.jsx";
import { COUNTRY_CODE, BUSINESS_WHATSAPP } from "./config";

export default function App() {
  // null = setup screen; object = active chat session
  const [session, setSession] = useState(null);

  // Send the user into WhatsApp with "Hi" prefilled, then start listening for
  // their inbound message to land in Firestore (the "bridge").
  const openWindow = ({ digits }) => {
    const docId = COUNTRY_CODE + digits; // e.g. 919354049041
    const waUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent("Hi")}`;
    // New tab/app so the listener page stays mounted underneath.
    window.open(waUrl, "_blank");
    setSession({
      digits,
      docId,
      phoneE164: "+" + docId, // e.g. +919354049041
    });
  };

  const reopenWhatsApp = () => {
    const waUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent("Hi")}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="phone">
      {session ? (
        <ChatScreen
          session={session}
          onBack={() => setSession(null)}
          onReopenWhatsApp={reopenWhatsApp}
        />
      ) : (
        <SetupScreen onOpen={openWindow} />
      )}
    </div>
  );
}
