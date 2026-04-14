export const generateImageWithCity = (baseImageUrl: string, city: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(baseImageUrl); return; }

      ctx.drawImage(img, 0, 0);

      // Semi-transparent dark bar at bottom
      const barHeight = img.height * 0.12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

      // City text
      const fontSize = Math.max(16, img.width * 0.05);
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(`📍 ${city}`, img.width / 2, img.height - barHeight / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(baseImageUrl);
    img.src = baseImageUrl;
  });
};
