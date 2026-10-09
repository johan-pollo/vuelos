const photos = {
  bogota: {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Bogot%C3%A1%2C_Monserrate%2C_2023-06_CN-02.jpg/1280px-Bogot%C3%A1%2C_Monserrate%2C_2023-06_CN-02.jpg',
    credit: 'Steffen Schmitz · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Bogot%C3%A1,_Monserrate,_2023-06_CN-02.jpg',
  },
  cali: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Cali_II.jpg',
    credit: 'David Alejandro Rendón · CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Cali_II.jpg',
  },
  medellin: {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Foto_C_%28116817349%29.jpeg/1280px-Foto_C_%28116817349%29.jpeg',
    credit: 'Jose Diez · CC BY 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Foto_C_(116817349).jpeg',
  },
  yopal: {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Alcald%C3%ADa_de_Yopal.jpg/1280px-Alcald%C3%ADa_de_Yopal.jpg',
    credit: 'Andrez 8976 la venganza · CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Alcald%C3%ADa_de_Yopal.jpg',
  },
}

export function destinationPhoto(destination) {
  const key = destination?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return photos[key] || photos.yopal
}
