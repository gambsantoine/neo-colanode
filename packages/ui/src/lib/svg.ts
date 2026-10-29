// Rasterizes a rendered SVG on a white background (for PNG export).
export const svgToPngBlob = (svg: string, scale = 2): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is not supported'));
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('The diagram could not be converted to PNG'));
        }
      }, 'image/png');
    };
    image.onerror = () =>
      reject(new Error('The diagram could not be converted to PNG'));
    image.src = svgToDataUrl(svg);
  });

// Rendered SVGs must be displayed through an <img> (never injected as markup)
// so that any script or event handler inside the diagram cannot run.
export const svgToDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
