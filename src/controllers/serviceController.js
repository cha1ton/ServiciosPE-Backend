// backend/src/controllers/serviceController.js

import Service from "../models/Service.js";
import User from "../models/User.js";
import { ImageService } from "../utils/imageService.js";
import { validateAndNormalizeLocation } from "../utils/geocoding.js";

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

    // ✅ Validar/normalizar ubicación con Google
    const validation = await validateAndNormalizeLocation({
      address: parsedAddress,
      coordinates: parsedCoordinates,
    });

    console.log("[Geo validation]", validation);

    if (!validation.ok) {
      const mapReasons = {
        NO_RESULTS:
          "No se encontró la dirección en Google Maps. Verifica calle y número.",
        ZERO_RESULTS:
          "No se encontró la dirección en Google Maps. Verifica calle y número.",
        NOT_IN_PERU: "La dirección no pertenece a Perú.",
        COORDINATES_MISMATCH:
          "Las coordenadas no coinciden con la dirección (desviación > 150m).",
        REQUEST_DENIED:
          "Clave de Google inválida o restringida (revisa restricciones y APIs habilitadas).",
        OVER_QUERY_LIMIT: "Se superó el límite de consultas a Google Maps.",
        INVALID_REQUEST: "Solicitud inválida a Geocoding (faltan campos).",
        UNKNOWN_ERROR: "Error temporal en Geocoding. Intenta de nuevo.",
      };
      return res.status(400).json({
        success: false,
        message:
          mapReasons[validation.reason] ||
          validation.error_message ||
          "Ubicación inválida",
      });
    }

    // Usar la dirección normalizada (incluye formatted, placeId y coords confiables)
    const addressDoc = validation.normalizedAddress;

    const service = new Service({
      ...serviceData,
      owner: req.user._id,
      images: processedImages,
      address: addressDoc,
      contact: parsedContact || undefined,
      schedule: parsedSchedule,
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
