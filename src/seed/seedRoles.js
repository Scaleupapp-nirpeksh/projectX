// src/seed/seedRoles.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db'); // Import the connectDB function
const Role = require('../models/Role');

const seed = async () => {
  try {
    // Call the centralized DB connection function
    await connectDB();
    console.log('Connected to DB');

    const roles = [
      {
        name: "admin",
        permissions: ["org:read", "org:write", "user:manage", "component:enable"]
      },
      {
        name: "member",
        permissions: ["org:read"]
      }
    ];

    for (const role of roles) {
      const existing = await Role.findOne({ name: role.name });
      if (!existing) {
        await Role.create(role);
        console.log(`Role ${role.name} created`);
      } else {
        console.log(`Role ${role.name} already exists`);
      }
    }

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seed();
