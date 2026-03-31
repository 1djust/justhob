import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@property-management/database';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const prisma = new PrismaClient();

async function fixUser() {
  const email = 'ogunduyijustus@gmail.com';
  
  // 1. Get user by email
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  const user = usersData?.users.find(u => u.email === email);
  
  // If user doesn't exist, create them
  if (!user) {
    console.log('User not found. Creating user directly...');
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { name: 'Justus Manager' }
    });
    
    if (createError) throw createError;
    
    let dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) {
        await prisma.user.create({
          data: {
            id: authData.user.id,
            email: authData.user.email!,
            name: authData.user.user_metadata?.name || 'Justus Manager'
          }
        });
        console.log('Ensured Prisma user exists.');
    }
    console.log('User created and confirmed. Password is Password123!');
    return;
  }
  
  // 2. Confirm email and reset password
  await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password: 'Password123!'
  });
  console.log('Confirmed user in Supabase and set password to Password123!');

  // 3. Ensure Prisma record exists
  let dbUser = await prisma.user.findUnique({ where: { email } });
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || 'Justus Manager'
      }
    });
    console.log('Ensured Prisma user exists.');
  }
  
  console.log('Done!');
}

fixUser();
