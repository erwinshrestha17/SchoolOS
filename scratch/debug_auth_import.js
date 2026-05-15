const path = require('path');
try {
  const dto = require('./apps/api/src/auth/dto/confirm-password-recovery.dto.ts');
  console.log('Successfully required .ts file (if using ts-node/tsx)');
} catch (e) {
  console.log('Failed to require .ts file:', e.message);
}

try {
  const controller = require('./apps/api/src/auth/auth.controller.ts');
  console.log('Successfully required controller');
} catch (e) {
  console.log('Failed to require controller:', e.message);
  console.log('Stack:', e.stack);
}
