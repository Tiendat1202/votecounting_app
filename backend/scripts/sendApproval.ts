import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { emailService } from '../src/services/emailService';

async function main() {
  const to = process.argv[2] || 'lthyor3@gmail.com';
  const name = process.argv[3] || 'Người dùng';
  console.log('Sending approval email to', to);
  // Wait for transporter to initialize (emailService initializes transporter asynchronously)
  let ready = await emailService.verifyConnection().catch(() => false);
  if (!ready) {
    // small retry loop
    for (let i = 0; i < 3 && !ready; i++) {
      console.log('Waiting for email transporter to be ready...');
      await new Promise((r) => setTimeout(r, 1000));
      ready = await emailService.verifyConnection().catch(() => false);
    }
  }

  const ok = ready ? await emailService.sendUserApprovalEmail(to, name) : false;
  console.log('Result:', ok);
  if (emailService.isEmailEnabled()) {
    console.log('Email enabled and attempt made.');
  } else {
    console.log('Email not enabled (logged only).');
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
