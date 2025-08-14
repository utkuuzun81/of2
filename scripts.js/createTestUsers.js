import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';

// Kullanıcıları oluşturmak için script
async function createUsers() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const users = [
    {
      email: 'admin@odyostore.com',
      password: await bcrypt.hash('Admin1234-', 10),
      role: 'admin',
      status: 'approved',
      personalInfo: { firstName: 'Admin', lastName: 'User' }
    },
    {
      email: 'center@odyostore.com',
      password: await bcrypt.hash('Center1234-', 10),
      role: 'center',
      status: 'approved',
      personalInfo: { firstName: 'Center', lastName: 'User' },
      companyInfo: { companyName: 'Odyostore Center' }
    },
    {
      email: 'supplier@odyostore.com',
      password: await bcrypt.hash('Supplier1234-', 10),
      role: 'supplier',
      status: 'approved',
      personalInfo: { firstName: 'Supplier', lastName: 'User' },
      companyInfo: { companyName: 'Odyostore Supplier' }
    }
  ];

  for (const user of users) {
    const exists = await User.findOne({ email: user.email });
    if (!exists) {
      await User.create(user);
      console.log(`Kullanıcı oluşturuldu: ${user.email}`);
    } else {
      console.log(`Zaten var: ${user.email}`);
    }
  }

  await mongoose.disconnect();
  console.log('Bitti.');
}

createUsers();
