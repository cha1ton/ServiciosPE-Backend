// backend/src/models/Service.js

import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "restaurante",
        "centro_salud",
        "lavanderia",
        "farmacia",
        "supermercado",
        "otros",
      ],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
      street: String,
      city: String,
      district: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    contact: {
      phone: String,
      email: String,
      website: String,
    },
    schedule: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },
    images: [
      {
        data: {
          type: String,
          required: true,
        },
        size: Number,
        format: String,
        originalName: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Validar máximo 3 imágenes
serviceSchema.pre("save", function (next) {
  if (this.images.length > 3) {
    throw new Error("No se pueden subir más de 3 imágenes");
  }
  next();
});

// Validar tamaño de imágenes (2MB máximo)
serviceSchema.path("images").validate(function (images) {
  const maxSize = 2 * 1024 * 1024; // 2MB en bytes
  return images.every((img) => img.size <= maxSize);
}, "Cada imagen debe ser menor a 2MB");

export default mongoose.model("Service", serviceSchema);
