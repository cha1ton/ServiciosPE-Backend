// backend/src/controllers/serviceController.js

import Service from '../models/Service.js';
import User from '../models/User.js';
import { ImageService } from '../utils/imageService.js';

export const createService = async (req, res) => {
  try {
    // Verificar que el usuario no sea ya proveedor (opcional)
    if (req.user.role === 'provider') {
      const existingService = await Service.findOne({ owner: req.user._id });
      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'Ya tienes un negocio registrado'
        });
      }
    }

    // Procesar imágenes si existen
    let processedImages = [];
    if (req.files && req.files.length > 0) {
      processedImages = await ImageService.processMultipleImages(req.files);
    }

    // Validar datos de ubicación (simulación - luego integraremos Google Maps API)
    const { address, coordinates, ...serviceData } = req.body;
    
    // Parsear coordenadas si vienen como string
    let parsedCoordinates = null;
    if (coordinates) {
      try {
        parsedCoordinates = typeof coordinates === 'string' 
          ? JSON.parse(coordinates) 
          : coordinates;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Formato de coordenadas inválido'
        });
      }
    }

    // Parsear address si viene como string
    let parsedAddress = null;
    if (address) {
      try {
        parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Formato de dirección inválido'
        });
      }
    }

    // Parsear schedule si viene como string
    let parsedSchedule = DEFAULT_SCHEDULE;
    if (serviceData.schedule) {
      try {
        parsedSchedule = typeof serviceData.schedule === 'string' 
          ? JSON.parse(serviceData.schedule) 
          : serviceData.schedule;
      } catch (error) {
        console.log('Usando horario por defecto debido a error de parsing');
      }
    }

    const service = new Service({
      ...serviceData,
      owner: req.user._id,
      images: processedImages,
      address: parsedAddress,
      coordinates: parsedCoordinates,
      schedule: parsedSchedule
    });

    await service.save();

    // Actualizar rol del usuario a "provider"
    await User.findByIdAndUpdate(req.user._id, { role: 'provider' });

    res.status(201).json({
      success: true,
      message: 'Servicio registrado exitosamente',
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        images: service.images.map(img => ({
          id: img._id,
          format: img.format,
          size: img.size
        }))
      }
    });

  } catch (error) {
    console.error('Error registrando servicio:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar el servicio'
    });
  }
};

export const getMyServices = async (req, res) => {
  try {
    const services = await Service.find({ owner: req.user._id })
      .select('-images.data') // No enviar los datos base64 de las imágenes para listar
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Error obteniendo servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios'
    });
  }
};

// Horario por defecto
const DEFAULT_SCHEDULE = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '09:00', close: '14:00' },
  sunday: { open: '', close: '' }
};