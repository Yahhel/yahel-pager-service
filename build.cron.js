require('dotenv').config();
const { execSync } = require('node:child_process');

const currentEnv = (process.env.NODE_ENV || '').trim();
const skipTest = (process.env.SKIP_TEST || '').trim();
console.log('ENVIRONMENT: ', currentEnv);
console.log('CRON_PORT: ', process.env.CRON_PORT);
console.log('SKIP_TEST: ', skipTest);


// Start App building
console.log('\n====BUILD APP START\n');
let output = execSync('nest build');
console.log(output.toString());
execSync('npm run docs:struct');
console.log('\n====BUILD APP END\n');
