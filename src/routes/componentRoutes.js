// src/routes/componentRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { listComponents } = require('../controllers/componentController');

router.use(authMiddleware);

router.get('/', listComponents);

module.exports = router;
