// backend/src/controllers/serviceEditController.js
import Service from '../models/Service.js';
import { ImageService } from '../utils/imageService.js';

const pruneEmptyStrings = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );

export const getMySingleService = async (req, res) => {
  try {
    const service = await Service.findOne({ owner: req.user._id })
      .select('-images.data'); // no enviar base64 en esta vista
    if (!service) {
      return res.status(404).json({ success: false, message: 'Aún no registraste un negocio' });
    }
    res.json({ success: true, service });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al obtener tu negocio' });
  }
};

export const updateMyService = async (req, res) => {
  try {
    const service = await Service.findOne({ owner: req.user._id });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Aún no registraste un negocio' });
    }

    // Parseo de payloads (todos opcionales)
    let parsedAddress = null;
    let parsedSchedule = null;
    let parsedCoordinates = null;
    let parsedContact = null;

    if (req.body.address) {
      try {
        parsedAddress = typeof req.body.address === 'string'
          ? JSON.parse(req.body.address)
          : req.body.address;
      } catch {}
    }
    if (req.body.schedule) {
      try {
        parsedSchedule = typeof req.body.schedule === 'string'
          ? JSON.parse(req.body.schedule)
          : req.body.schedule;
      } catch {}
    }
    if (req.body.coordinates) {
      try {
        parsedCoordinates = typeof req.body.coordinates === 'string'
          ? JSON.parse(req.body.coordinates)
          : req.body.coordinates;
      } catch {}
    }
    if (req.body.contact) {
      try {
        parsedContact = typeof req.body.contact === 'string'
          ? JSON.parse(req.body.contact)
          : req.body.contact;
      } catch {}
    }

    // Actualizaciones campo a campo (opcionales)
    if (req.body.name)        service.name = req.body.name;
    if (req.body.description) service.description = req.body.description;
    if (req.body.category)    service.category = req.body.category;

    if (parsedContact) {
      service.contact = { ...service.contact, ...pruneEmptyStrings(parsedContact) };
    }

    // Asegura objeto address
    service.address = service.address || {};

    // Campos textuales de address (NO coords)
    if (parsedAddress) {
      const cleaned = pruneEmptyStrings(parsedAddress);
      const keys = ['street', 'city', 'district', 'reference', 'formatted'];
      keys.forEach((k) => {
        if (cleaned[k] !== undefined) {
          service.address[k] = cleaned[k];
        }
      });
    }

    // Coordenadas SOLO si llegan explícitamente válidas
    if (
      parsedCoordinates &&
      parsedCoordinates.lat != null &&
      parsedCoordinates.lng != null
    ) {
      service.address.coordinates = {
        lat: Number(parsedCoordinates.lat),
        lng: Number(parsedCoordinates.lng),
      };
    }

    if (parsedSchedule) {
      service.schedule = parsedSchedule;
    }

    // Reemplazo total de imágenes: si llegan 3, reemplaza todas
    if (req.files && req.files.length === 3) {
      const processed = await ImageService.processMultipleImages(req.files);
      service.images = processed;
    }

    await service.save();

    res.json({
      success: true,
      message: 'Negocio actualizado correctamente',
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
      }
    });
  } catch (e) {
    console.error('Error actualizando negocio:', e);
    res.status(500).json({ success: false, message: 'Error al actualizar negocio' });
  }
};
