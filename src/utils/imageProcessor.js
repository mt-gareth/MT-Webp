export async function processImage(file, targetWidth = 0, targetHeight = 0, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
  
      reader.onload = e => {
        img.src = e.target.result;
      };
  
      img.onload = () => {
        let originalWidth = img.width;
        let originalHeight = img.height;
  
        let width = targetWidth;
        let height = targetHeight;
  
        if (targetWidth && targetHeight) {
          const ratio = Math.min(targetWidth / img.width, targetHeight / img.height);
          width = Math.round(img.width * ratio);
          height = Math.round(img.height * ratio);
        } else if (targetWidth) {
          width = targetWidth;
          height = Math.round((img.height / img.width) * targetWidth);
        } else if (targetHeight) {
          height = targetHeight;
          width = Math.round((img.width / img.height) * targetHeight);
        } else {
          width = img.width;
          height = img.height;
        }
  
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
  
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas conversion failed.'));
        }, 'image/webp', quality);
      };
  
      reader.onload = e => {
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File read error'));
      img.onerror = () => reject(new Error('Image loading failed.'));
      reader.onerror = () => reject(new Error('File read error'));
  
      reader.readAsDataURL(file);
    });
  }
  