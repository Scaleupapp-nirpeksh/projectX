const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  logoURL: { type: String, trim: true },
  description: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  registrationId: { type: String, trim: true },
  creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  industry: { type: String, trim: true },
  website: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },

  // New field for components
  components: [
    {
      componentName: { 
        type: String, 
        required: true, 
        enum: ['finance', 'tasks', 'documentation'] // Limit to these 3 for now
      },
      enabled: { type: Boolean, default: false },
      userAccess: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          hasAccess: { type: Boolean, default: false }
        }
      ]
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
