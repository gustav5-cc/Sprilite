const imageUpload = document.getElementById('imageUpload');
const originalCanvas = document.getElementById('originalCanvas');
const normalMapCanvas = document.getElementById('normalMapCanvas');
const downloadLink = document.getElementById('downloadLink');
const status = document.getElementById('status');
const strengthSlider = document.getElementById('strength');
const strengthValue = document.getElementById('strengthValue');

// Filter selection elements
const sobelFilterRadio = document.getElementById('sobelFilter');
const scharrFilterRadio = document.getElementById('scharrFilter');

// Inversion control elements
const invertHeightCheckbox = document.getElementById('invertHeight');
const invertRedCheckbox = document.getElementById('invertRed');
const invertGreenCheckbox = document.getElementById('invertGreen');

const originalCtx = originalCanvas.getContext('2d');
const normalMapCtx = normalMapCanvas.getContext('2d');

let originalImageData = null;    // Store original image data to reprocess
let originalImage = new Image(); // Store the loaded image object

// --- Utility Functions ---

// Get grayscale representation of the image
function getGrayscale(imageData, x, y) {
    const width = imageData.width;

    const clampedX = Math.max(0, Math.min(x, width - 1));
    const clampedY = Math.max(0, Math.min(y, imageData.height - 1));
    const index = (clampedY * width + clampedX) * 4;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];

    return (r * 0.299 + g * 0.587 + b * 0.114) / 255.0; // Normalize to 0.0 - 1.0
}

// --- Event Listeners ---

imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        status.textContent = 'No file selected.';
        return;
    }
    if (!file.type.startsWith('image/')) {
        status.textContent = 'Please select an image file.';
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        status.textContent = 'Loading image...';
        originalImage.onload = () => {
            status.textContent = 'Processing...';
            setTimeout(() => {
                originalCanvas.width = originalImage.width;
                originalCanvas.height = originalImage.height;
                normalMapCanvas.width = originalImage.width;
                normalMapCanvas.height = originalImage.height;

                originalCtx.drawImage(originalImage, 0, 0);

                try {
                    originalImageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
                    generateNormalMap();
                } catch (error) {
                     if (error.name === 'SecurityError') {
                        status.textContent = 'Error: Cannot process image from cross-origin source.';
                        alert('Could not process the image due to security restrictions (cross-origin issues). Try downloading the image and uploading it directly.');
                     } else {
                        status.textContent = `Error processing image: ${error.message}`;
                        console.error("Error getting image data:", error);
                     }
                     clearCanvases();
                }
            }, 50);
        };
        originalImage.onerror = () => {
            status.textContent = 'Error loading image file.';
            clearCanvases();
        };
        originalImage.src = e.target.result;
    };

    reader.onerror = () => {
        status.textContent = 'Error reading file.';
        clearCanvases();
    };

    status.textContent = 'Reading file...';
    reader.readAsDataURL(file);
});

strengthSlider.addEventListener('input', () => {
    strengthValue.textContent = parseFloat(strengthSlider.value).toFixed(1);
    if (originalImageData) {
        generateNormalMap();
    }
});

// Event listeners for filter type change
sobelFilterRadio.addEventListener('change', () => {
    if (originalImageData) {
        generateNormalMap();
    }
});

scharrFilterRadio.addEventListener('change', () => {
    if (originalImageData) {
        generateNormalMap();
    }
});

// Event listeners for inversion controls
invertHeightCheckbox.addEventListener('change', () => {
    if (originalImageData) {
        generateNormalMap();
    }
});
invertRedCheckbox.addEventListener('change', () => {
    if (originalImageData) {
        generateNormalMap();
    }
});
invertGreenCheckbox.addEventListener('change', () => {
    if (originalImageData) {
        generateNormalMap();
    }
});


// Normal map generator, handles different scenarios for user selections
function generateNormalMap() {
    if (!originalImageData) return;

    const width = originalImageData.width;
    const height = originalImageData.height;
    const strength = parseFloat(strengthSlider.value);
    const selectedFilter = document.querySelector('input[name="filterType"]:checked').value;

    // Get inversion states, check if we will invert result
    const invertHeight = invertHeightCheckbox.checked;
    const invertRed = invertRedCheckbox.checked;
    const invertGreen = invertGreenCheckbox.checked;

    const normalMapData = normalMapCtx.createImageData(width, height);
    const outputData = normalMapData.data;
    const sourceData = originalImageData.data; // For reading alpha

    status.textContent = `Processing (${width}x${height}) with ${selectedFilter} filter...`;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const g1 = getGrayscale(originalImageData, x - 1, y - 1);
            const g2 = getGrayscale(originalImageData, x,     y - 1);
            const g3 = getGrayscale(originalImageData, x + 1, y - 1);
            const g4 = getGrayscale(originalImageData, x - 1, y);
            const g6 = getGrayscale(originalImageData, x + 1, y);
            const g7 = getGrayscale(originalImageData, x - 1, y + 1);
            const g8 = getGrayscale(originalImageData, x,     y + 1);
            const g9 = getGrayscale(originalImageData, x + 1, y + 1);

            let gx_val, gy_val;
            
            // Use sobel filtering unless scharr selected
            if (selectedFilter === 'scharr') {
                gx_val = -3*g1 + 3*g3  -10*g4 + 10*g6  -3*g7 + 3*g9;
                gy_val = -3*g1 -10*g2 -3*g3   +3*g7 + 10*g8 + 3*g9;
            } else {
                gx_val = -g1 + g3 - 2*g4 + 2*g6 -g7 + g9;
                gy_val = -g1 - 2*g2 - g3 + g7 + 2*g8 + g9;
            }

            // Apply height inversion if checked (flips the gradient)
            if (invertHeight) {
                gx_val = -gx_val;
                gy_val = -gy_val;
            }

            let nx = gx_val * strength;
            let ny = gy_val * strength;
            let nz = 1.0;

            const length = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (length > 0) {
                nx /= length;
                ny /= length;
                nz /= length;
            } else {
                nx = 0;
                ny = 0;
                nz = 1;
            }

            // Map normal components to 0.0 - 1.0 range
            let r_component = (nx + 1.0) * 0.5;
            let g_component = (ny + 1.0) * 0.5;
            const b_component = (nz + 1.0) * 0.5;

            // Apply channel inversions if checked
            if (invertRed) {
                r_component = 1.0 - r_component;
            }
            if (invertGreen) {
                g_component = 1.0 - g_component;
            }

            const r = Math.round(r_component * 255);
            const g = Math.round(g_component * 255);
            const b = Math.round(b_component * 255);

            const index = (y * width + x) * 4;
            outputData[index]     = r;
            outputData[index + 1] = g;
            outputData[index + 2] = b;
            outputData[index + 3] = sourceData[index + 3]; // Copy alpha channel
        }
    }

    normalMapCtx.putImageData(normalMapData, 0, 0);

    try {
        const dataUrl = normalMapCanvas.toDataURL('image/png');
        downloadLink.href = dataUrl;
        const originalFileName = imageUpload.files[0]?.name.split('.').slice(0, -1).join('.') || 'image';
        downloadLink.download = `${originalFileName}_normal_${selectedFilter}.png`;
        downloadLink.style.display = 'inline-block';
        status.textContent = 'Normal map generated successfully!';
    } catch (error) {
         if (error.name === 'SecurityError') {
            status.textContent = 'Error: Cannot export canvas (tainted by cross-origin data).';
            alert('Could not create download link due to security restrictions (tainted canvas). This can happen if the image source is cross-origin.');
         } else {
            status.textContent = `Error creating download link: ${error.message}`;
            console.error("Error creating data URL:", error);
         }
        downloadLink.style.display = 'none';
    }
}

function clearCanvases() {
     originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
     normalMapCtx.clearRect(0, 0, normalMapCanvas.width, normalMapCanvas.height);
     originalCanvas.width = 100;
     originalCanvas.height = 100;
     normalMapCanvas.width = 100;
     normalMapCanvas.height = 100;
     downloadLink.style.display = 'none';
     originalImageData = null;
     originalImage.src = '';
     // Reset checkboxes to default (unchecked)
     invertHeightCheckbox.checked = false;
     invertRedCheckbox.checked = false;
     invertGreenCheckbox.checked = false;
}

strengthValue.textContent = parseFloat(strengthSlider.value).toFixed(1);