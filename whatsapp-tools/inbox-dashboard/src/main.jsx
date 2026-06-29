import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// NOTE: StrictMode is intentionally NOT used. In dev it double-invokes effects,
// which would fire the n8n webhook twice on send → duplicate executions.
createRoot(document.getElementById("root")).render(<App />);
