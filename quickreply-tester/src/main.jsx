import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// NOTE: StrictMode is intentionally NOT used. In dev it double-invokes effects,
// which fired the opener webhook twice → duplicate n8n executions. This is a
// testing tool where each send must hit n8n exactly once.
createRoot(document.getElementById("root")).render(<App />);
