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

engine.registerFilter("json", (obj) => {
  return JSON.stringify(obj);
});

engine.registerFilter("image_url", (url, options) => {
  return url; // simple fallback
});

// --- Custom Tags for Shopify Compatibility ---
engine.registerTag("paginate", {
  parse: function (tagToken, remainTokens) {
    this.tpls = [];
    var closed = false;
    while (remainTokens.length) {
      var token = remainTokens.shift();
      if (token.name === "endpaginate") {
        closed = true;
        break;
      }
      this.tpls.push(this.liquid.parser.parseToken(token, remainTokens));
    }
    if (!closed) throw new Error(`tag ${tagToken.getText()} not closed`);
  },
  render: function* (scope) {
    yield this.liquid.renderer.renderTemplates(this.tpls, scope);
  },
});

engine.registerTag("endpaginate", {
  parse: () => {},
  render: () => {},
});

// --- Routes ---
app.get("/", (req, res) => {
  res.render("index", {
    collections: {
      all: {
        products: []
      }
    }
  });
});

app.listen(5001, () => {
  console.log("✅ Advanced Questionnaire server running at http://localhost:5001");
});
