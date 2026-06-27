const fs = require('fs');
const https = require('https');

https.get('https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Nacional_Gas_logo.svg/512px-Nacional_Gas_logo.svg.png', (res) => {
  const file = fs.createWriteStream('./public/assets/logos/logo_nacional.png');
  res.pipe(file);
});
