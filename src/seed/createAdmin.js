// run with: node dist/seed/createAdmin.js  OR use ts/node depending on build
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = process.env.INIT_ADMIN_EMAIL || 'admin@dsqr.com';
  const password = process.env.INIT_ADMIN_PASS || 'ChangeMe123';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin already exists');
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ email, passwordHash, name: 'DSQR Admin', role: 'admin' });
  await user.save();
  console.log('Created admin:', email);
  await mongoose.disconnect();
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
