import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const resendMatch = envContent.match(/RESEND_API_KEY\s*=\s*([^\r\n]+)/);

console.log("RESEND_API_KEY configurada en .env.local?:", !!resendMatch);
if (resendMatch) {
  console.log("Key prefix:", resendMatch[1].trim().slice(0, 8) + '...');
}
