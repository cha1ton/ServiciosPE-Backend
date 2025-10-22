// backend/src/controllers/serviceController.js

import Service from '../models/Service.js';
import User from "../models/User.js";
import { ImageService } from "../utils/imageService.js";
import { validateAndNormalizeLocation } from "../utils/geocoding.js";
import { reverseGeocode } from '../utils/geocoding.js';

// ANTIGUO 

export const createService = async (req, res) => {
  try {
    if (req.user.role === "provider") {
      const existingService = await Service.findOne({ owner: req.user._id });
      if (existingService) {
        return res
          .status(400)
          .json({ success: false, message: "Ya tienes un negocio registrado" });
      }
    }

    let processedImages = [];
    if (req.files && req.files.length > 0) {
      processedImages = await ImageService.processMultipleImages(req.files);
    }

    const { address, coordinates, contact, ...serviceData } = req.body;

    // address
    let parsedAddress = null;
    if (address) {
      try {
        parsedAddress =
          typeof address === "string" ? JSON.parse(address) : address;
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Formato de dirección inválido" });
      }
    }

    // coordinates
    let parsedCoordinates = null;
    if (coordinates) {
      try {
        parsedCoordinates =
          typeof coordinates === "string"
            ? JSON.parse(coordinates)
            : coordinates;
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Formato de coordenadas inválido" });
      }
    }

    // schedule
    let parsedSchedule = DEFAULT_SCHEDULE;
    if (serviceData.schedule) {
      try {
        parsedSchedule =
          typeof serviceData.schedule === "string"
            ? JSON.parse(serviceData.schedule)
            : serviceData.schedule;
      } catch {
        console.log("Usando horario por defecto debido a error de parsing");
      }
    }

    // contact
    let parsedContact = null;
    if (contact) {
      try {
        parsedContact =
          typeof contact === "string" ? JSON.parse(contact) : contact;
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Formato de contacto inválido" });
      }
    }

    // 1) Requerir coordenadas (pin)
    if (!parsedCoordinates || parsedCoordinates.lat == null || parsedCoordinates.lng == null) {
      return res.status(400).json({
        success: false,
        message: 'Selecciona la ubicación en el mapa'
      });
    }

    // 2) Construir address con coords como verdad
    const addressDoc = parsedAddress || {};
    addressDoc.coordinates = {
      lat: Number(parsedCoordinates.lat),
      lng: Number(parsedCoordinates.lng)
    };

    // 3) (Opcional) Reverse geocoding para formatted/placeId (no bloqueante)
    try {
      const rev = await reverseGeocode(addressDoc.coordinates.lat, addressDoc.coordinates.lng);
      if (rev.ok) {
        addressDoc.formatted = rev.formattedAddress;
        addressDoc.placeId = rev.placeId;
      }
    } catch (e) {
      console.warn('[Reverse geocoding] falló; guardo solo coords');
    }

    // 4) Guardar
    const service = new Service({
      ...serviceData,              // name, description, category
      owner: req.user._id,
      images: processedImages,
      address: addressDoc,         // ← coords (y formatted si hubo reverse)
      contact: parsedContact || undefined,
      schedule: parsedSchedule
    });

    await service.save();
    await User.findByIdAndUpdate(req.user._id, { role: "provider" });

    res.status(201).json({
      success: true,
      message: "Servicio registrado exitosamente",
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        images: service.images.map((img) => ({
          id: img._id,
          format: img.format,
          size: img.size,
        })),
      },
    });
  } catch (error) {
    console.error("Error registrando servicio:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error al registrar el servicio",
    });
  }
};

export const getMyServices = async (req, res) => {
  try {
    const services = await Service.find({ owner: req.user._id })
      .select("-images.data") // No enviar los datos base64 de las imágenes para listar
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Error obteniendo servicios:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener servicios",
    });
  }
};

export const getServicePublic = async (req, res) => {
  try {
    const { id } = req.params;

    const svc = await Service.findById(id)
      .select('name description category address rating contact images schedule createdAt')
      .lean();

    if (!svc) {
      return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    }

    // Normaliza imágenes a data URL (MVP)
    const images = (svc.images || []).map(img => ({
      url: img?.data ? `data:image/${img.format || 'jpeg'};base64,${img.data}` : '',
      format: img.format,
      size: img.size,
      originalName: img.originalName,
      uploadedAt: img.uploadedAt,
    }));

    return res.json({
      success: true,
      service: {
        id: String(svc._id),
        name: svc.name,
        description: svc.description || '',
        category: svc.category || 'otros',
        address: {
          formatted: svc.address?.formatted || '',
          street: svc.address?.street || '',
          district: svc.address?.district || '',
          city: svc.address?.city || '',
          coordinates: svc.address?.coordinates || null,
        },
        rating: svc.rating || { average: 0, count: 0 },
        contact: svc.contact || {},
        images,
        schedule: svc.schedule || null,
        createdAt: svc.createdAt,
      }
    });
  } catch (e) {
    console.error('Error obteniendo servicio público:', e);
    return res.status(500).json({ success: false, message: 'Error obteniendo servicio' });
  }
};

// Horario por defecto
const DEFAULT_SCHEDULE = {
  monday: { open: "09:00", close: "18:00" },
  tuesday: { open: "09:00", close: "18:00" },
  wednesday: { open: "09:00", close: "18:00" },
  thursday: { open: "09:00", close: "18:00" },
  friday: { open: "09:00", close: "18:00" },
  saturday: { open: "09:00", close: "14:00" },
  sunday: { open: "", close: "" },
};
