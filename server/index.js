'use strict';
const path = require('node:path');
const { openDatabase } = require('./db');
const { seed, isEmpty, DEMO_EMAIL, DEFAULT_DEMO_PASSWORD } = require('./seed');
const { createApp } = require('./app');

const file = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'mates.db');
const db = openDatabase(file);
if (isEmpty(db)) {
  seed(db);
  console.log(`Empty database: seeded demo data into ${file}`);
}

// The demo account is shared and public on purpose; set PUBLIC_DEMO=false to hide it.
const demo = process.env.PUBLIC_DEMO === 'false'
  ? null
  : { email: DEMO_EMAIL, password: process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD };

const app = createApp(db, {
  trustProxy: process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'false',
  demo,
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Mates listening on http://localhost:${port}`));
