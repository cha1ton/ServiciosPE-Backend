import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  photo: {
    type: String,
    default: ''
    
  },
  nickname: {
    type: String,
    default: ''
  },
  customPhoto: {
    type: String,
    default: ''
  },
  searchHistory: [{
    query: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    filters: Object
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  role: {
    type: String,
    enum: ['user', 'provider', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Limitar el historial de búsquedas a 10 elementos
userSchema.methods.addToSearchHistory = function(searchData) {
  this.searchHistory.unshift(searchData);
  if (this.searchHistory.length > 10) {
    this.searchHistory = this.searchHistory.slice(0, 10);
  }
  return this.save();
};

export default mongoose.model('User', userSchema);