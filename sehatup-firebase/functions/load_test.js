
try {
  const functions = require('./index.js');
  console.log('Successfully loaded index.js!');
  console.log('Exported functions found:', Object.keys(functions));
} catch (e) {
  console.error('FAILED TO LOAD index.js:');
  console.error(e.stack);
}
