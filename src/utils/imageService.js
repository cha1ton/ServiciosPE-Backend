import sharp from 'sharp';

export class ImageService {
  // Convertir buffer de imagen a base64 y optimizar
  static async processImage(fileBuffer, maxWidth = 800) {
    try {
      // Optimizar imagen con sharp
      const optimizedBuffer = await sharp(fileBuffer)
        .resize(maxWidth, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Convertir a base64 para almacenar en MongoDB
      const base64Image = optimizedBuffer.toString('base64');
      const imageSize = optimizedBuffer.length;

      return {
        data: base64Image,
        size: imageSize,
        format: 'jpeg'
      };
    } catch (error) {
      throw new Error('Error procesando imagen: ' + error.message);
    }
  }

  // Procesar múltiples imágenes (para servicios)
  static async processMultipleImages(files) {
    const processedImages = [];

    for (const file of files) {
      try {
        const processedImage = await this.processImage(file.buffer);
        processedImages.push({
          data: processedImage.data,
          size: processedImage.size,
          format: processedImage.format,
          originalName: file.originalname,
          uploadedAt: new Date()
        });
      } catch (error) {
        throw new Error(`Error procesando ${file.originalname}: ${error.message}`);
      }
    }

    return processedImages;
  }

  // Procesar imagen de perfil (más pequeña)
  static async processProfileImage(fileBuffer) {
    try {
      // Para perfil, hacemos la imagen más pequeña (200x200)
      const optimizedBuffer = await sharp(fileBuffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      const base64Image = optimizedBuffer.toString('base64');
      const imageSize = optimizedBuffer.length;

      return {
        data: base64Image,
        size: imageSize,
        format: 'jpeg'
      };
    } catch (error) {
      throw new Error('Error procesando imagen de perfil: ' + error.message);
    }
  }
}