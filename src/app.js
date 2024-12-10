// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const componentRoutes = require('./routes/componentRoutes');
const financeRoutes = require('./routes/financeRoutes')

const app = express();
app.use(cors());
app.use(express.json());
console.log('MONGO_URI:', process.env.MONGO_URI);

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/components', componentRoutes); 
app.use('/api/finance', financeRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
