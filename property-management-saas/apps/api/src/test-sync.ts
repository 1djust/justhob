import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function testSync() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ogunduyijustus@gmail.com',
    password: 'Password123!'
  });

  if (error) {
    console.error('Login Error:', error.message);
    return;
  }

  const token = data.session?.access_token;
  if (!token) return console.error('No token returned');

  console.log('Got token:', token.substring(0, 20) + '...');

  const res = await fetch('http://localhost:3001/api/auth/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ` + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Justus Manager' })
  });

  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', body);
}

testSync().catch(console.error);
