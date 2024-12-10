require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db'); // Import the centralized connectDB function
const Component = require('../models/Component');

const componentsToSeed = [
  {
    name: 'finance',
    displayName: 'Finance Management',
    description: 'Manage budgets, expenses, and revenues.'
  },
  {
    name: 'tasks',
    displayName: 'Task & Resource Manager',
    description: 'Create, assign, and track tasks and resources.'
  },
  {
    name: 'documentation',
    displayName: 'Documentation Management',
    description: 'Manage documents, wikis, and other content.'
  }
];

(async () => {
  try {
    await connectDB(); // Use the connectDB function instead of mongoose.connect directly
    console.log('Connected to DB');

    for (const comp of componentsToSeed) {
      const existing = await Component.findOne({ name: comp.name });
      if (!existing) {
        await Component.create(comp);
        console.log(`Component ${comp.name} created`);
      } else {
        console.log(`Component ${comp.name} already exists`);
      }
    }

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
