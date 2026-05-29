const fs = require('fs');
fs.appendFileSync('src/index.css', '\n@keyframes fadeout { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(4px); } }\n.fade-out { animation: fadeout .22s ease both; }\n');
