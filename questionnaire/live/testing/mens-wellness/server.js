// server.js
import express from "express";
import { Liquid } from "liquidjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { mockShopifyProducts } from "../_shared/mock-products.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Shared Paths ---
const sharedPath = path.resolve(__dirname, "..", "_shared");

// --- Liquid Engine Setup ---
const engine = new Liquid({
  root: [path.resolve(__dirname, "views"), path.resolve(sharedPath, "views")],
  extname: ".liquid",
  partials: [path.resolve(__dirname, "views/snippets"), path.resolve(sharedPath, "views/snippets")],
});

// Tell Express to use Liquid
app.engine("liquid", engine.express());
app.set("views", "./views");
app.set("view engine", "liquid");

// Serve assets from /public (local first, then shared)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(sharedPath, "public")));

// --- Liquid Filters ---
engine.registerFilter("asset_url", (filename) => "/" + filename);
engine.registerFilter("stylesheet_tag", (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter("script_tag", (url) => `<script src="${url}"></script>`);
engine.registerFilter("image_url", (src, _opts) => src || "");
engine.registerFilter("json", (val) => JSON.stringify(val));

const shopifyProductsScript = `<script>
  window.shopifyLiveProducts = ${JSON.stringify(mockShopifyProducts, null, 2)};
</script>`;

// --- Preprocess template: strip Shopify-specific paginate block ---
function preprocessLiquid(templateStr) {
  // Remove the entire {% paginate %}...{% endpaginate %} block
  return templateStr.replace(
    /\{%-?\s*paginate[\s\S]*?endpaginate\s*-?%\}/g,
    ""
  );
}

// --- Routes ---
// Map standard 'firebase-config.js' to the shared test config
app.get("/firebase-config.js", (req, res) => {
  res.sendFile(path.join(sharedPath, "public", "firebase-config.js"));
});

app.get("/", async (req, res) => {
  try {
    const templatePath = path.join(__dirname, "views", "index.liquid");
    const rawTemplate = fs.readFileSync(templatePath, "utf-8");
    const cleanedTemplate = preprocessLiquid(rawTemplate);

    const html = await engine.parseAndRender(cleanedTemplate, {});

    // Inject mock shopifyLiveProducts BEFORE the firebase-config script or any asset-url script
    const injected = html.replace(
      /(<script[^>]*src="[^"]*firebase-config\.js"[^>]*><\/script>)/,
      `${shopifyProductsScript}\n$1`
    );

    res.send(injected);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre style="color:red">${err.message}\n\n${err.stack}</pre>`);
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Questionnaire server running at http://localhost:${PORT}`);
});
