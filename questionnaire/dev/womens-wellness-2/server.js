// server.js
import express from "express";
import { Liquid } from "liquidjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Liquid Engine Setup ---
const engine = new Liquid({
  root: path.resolve(__dirname, "views"), // Templates root
  extname: ".liquid",
  partials: path.resolve(__dirname, "views/snippets"),
});

// Tell Express to use Liquid
app.engine("liquid", engine.express());
app.set("views", "./views");
app.set("view engine", "liquid");

// Serve assets from /public
app.use(express.static(path.join(__dirname, "public")));

// --- Liquid Filters ---
engine.registerFilter("asset_url", (filename) => {
  return `/` + filename; // maps to /public/filename
});

engine.registerFilter("stylesheet_tag", (url) => {
  return `<link rel="stylesheet" href="${url}">`;
});

engine.registerFilter("script_tag", (url) => {
  return `<script src="${url}"></script>`;
});

// --- Routes ---
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(5000, () => {
  console.log("✅ Questionnaire server running at http://localhost:5000");
});
