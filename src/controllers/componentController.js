// src/controllers/componentController.js
const Component = require('../models/Component');

exports.listComponents = async (req, res) => {
  try {
    const components = await Component.find({});
    res.json({ components });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
