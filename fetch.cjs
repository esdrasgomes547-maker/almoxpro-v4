const https = require('https');
https.get('https://raw.githubusercontent.com/esdrasgomes547-maker/ALTEC/main/PROMPT_AI_STUDIO_SAAS.md', (res) => {
  let data = '';
  res.on('data', (d) => {
    data += d;
  });
  res.on('end', () => {
    const fs = require('fs');
    fs.writeFileSync('prompt_rules.md', data);
    console.log('Done');
  });
});
