// src/models/Partner.js

const mongoose = require('mongoose');

const ContactInfoSchema = new mongoose.Schema({
  email: { type: String, required: false },
  phone: { type: String, required: false },
  address: { type: String, required: false },
}, { _id: false });

const PartnerSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Partner name is required.'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['vendor', 'client'],
    required: [true, 'Partner type is required.'],
  },
  contactInfo: {
    type: ContactInfoSchema,
    default: {},
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinanceCategory',
    required: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('Partner', PartnerSchema);
