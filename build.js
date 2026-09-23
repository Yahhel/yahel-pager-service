require('dotenv').config();
const { execSync } = require('node:child_process');

const currentEnv = (process.env.NODE_ENV || '').trim();
const skipTest = (process.env.SKIP_TEST || '').trim();
console.log('ENVIRONMENT: ', currentEnv);
console.log('PORT: ', process.env.PORT);
console.log('SKIP_TEST: ', skipTest);

// Start App building
console.log('\n====BUILD APP START\n');
let output = execSync('nest build');
console.log(output.toString());
execSync('npm run docs:struct');
console.log('\n====BUILD APP END\n');

// Start DB indexing process
console.log('\n====DATABASE INDEXING START\n');
output = execSync('npm run db:indexes');
console.log(output.toString());
console.log('\n====DATABASE INDEXING END\n');

// Start data seeding for deployment
if (skipTest !== 'true') {
  console.log('\n====TEST ENV SEEDING START \n');
  output = execSync('npm run seed:test');
  console.log(output.toString());
  console.log('\n====TEST ENV SEEDING END\n');

  // Start test runner for deployment
  console.log('\n====TEST RUNNER START\n');
  output = execSync('npm run test && npm run test:e2e');
  console.log(output.toString());
  output = execSync('npm run seed:delete:test');
  console.log(output.toString());
  console.log('\n====TEST RUNNER END\n');
}

// run seeder for development db
if (currentEnv.includes('development')) {
  console.log('\n====DEVELOPMENT ENV SEEDING START\n');
  output = execSync('npm run seed');
  console.log(output.toString());
  console.log('\n====DEVELOPMENT ENV SEEDING END\n');
}

// run once prod/stage seeder data only.
if (currentEnv.includes('production') || currentEnv.includes('stage')) {
  console.log('\n====PRODUCTION ENV SEEDING START\n');
  output = execSync('npm run seed:prod');
  console.log(output.toString());
  console.log('\n====PRODUCTION ENV SEEDING END\n');
}
