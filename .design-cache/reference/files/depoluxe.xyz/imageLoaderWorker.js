self.onmessage = async (event) => {
  const { id, src } = event.data;

  try {
    // Fetch para obtener la imagen
    const response = await fetch(src);

    // Verificamos si la respuesta es correcta
    if (response.ok) {
      // Convertimos la imagen a Blob
      const blob = await response.blob();
      // Creamos una URL del Blob
      const imageUrl = URL.createObjectURL(blob);
      // Enviamos la URL de vuelta al hilo principal
      self.postMessage({ id, src: imageUrl, status: 'loaded' });
    } else {
      self.postMessage({ id, status: 'error' });
    }
  } catch (error) {
    // En caso de error, enviamos un mensaje de error
    self.postMessage({ id, status: 'error', message: error.message });
  }
};
