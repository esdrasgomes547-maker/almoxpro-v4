const fs = require('fs');
const path = require('path');

const tecgasBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAIwAAAA8CAYAAABQO9TTAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVHhe7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4mhcSAAGUj+kZAAAAAElFTkSuQmCC';

const nacionalBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAJEAAAAkCAYAAAC0V0XkAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABPSURBVHhe7cExAQAAAMKg9U9tCj8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoA1wTgABu/l+KwAAAABJRU5ErkJggg==';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(__dirname, 'public/assets/logos'));

fs.writeFileSync(path.join(__dirname, 'public/assets/logos/logo_tecgas.png'), Buffer.from(tecgasBase64, 'base64'));
fs.writeFileSync(path.join(__dirname, 'public/assets/logos/logo_nacional.png'), Buffer.from(nacionalBase64, 'base64'));

console.log('Logos created successfully');
