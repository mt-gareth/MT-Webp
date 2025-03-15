<template>
  <div class="max-w-xl mx-auto p-4 flex justify-center items-center h-[100vh] flex-row">
    <!-- Drag-and-drop zone -->
    <label class="flex border-2 border-dashed border-gray-300 rounded p-6 text-center justify-center align-center" 
         :class="{ 'border-blue-500 bg-blue-50': isDragging }"
         @dragover.prevent="onDragOver" 
         @dragleave.prevent="onDragLeave" 
         @drop.prevent="onDrop">
      <p class="text-gray-500">
        <span v-if="!isDragging">Drag & drop images here, or click to select files</span>
        <span v-else>Release to drop the files</span>
      </p>
      <input 
        type="file" multiple accept="image/*" 
        class="hidden" ref="fileInput" 
        @change="onFileChange" 
      />
    </label>
    
    <!-- File list preview -->
    <div v-if="files.length" class="mt-4 space-y-2">
      <div v-for="(fileObj, index) in files" :key="fileObj.id" class="flex items-center justify-between p-2 bg-gray-100 rounded">
        <div class="flex items-center space-x-4">
          <!-- Thumbnail preview -->
          <img :src="fileObj.preview" alt="" class="w-16 h-16 object-cover rounded"/>
          <!-- File name and size -->
          <div>
            <p class="font-medium">{{ fileObj.file.name }}</p>
            <p class="text-sm text-gray-600">{{ formatSize(fileObj.file.size) }}</p>
          </div>
        </div>
        <!-- Remove file button -->
        <button @click="removeFile(index)" class="text-red-500 hover:text-red-700">&times;</button>
      </div>
    </div>

    <!-- Conversion options -->
    <div v-if="files.length" class="mt-6 p-4 border rounded">
      <h3 class="font-semibold mb-2">Output Settings:</h3>
      <!-- Preset sizes dropdown -->
      <label class="block mb-2">Preset Size:
        <select v-model="selectedPreset" @change="onPresetChange" class="ml-2 p-1 border rounded">
          <option value="">Custom</option>
          <option v-for="preset in presets" :key="preset.label" :value="preset">
            {{ preset.label }} ({{ preset.width }}x{{ preset.height }})
          </option>
        </select>
      </label>
      <!-- Custom dimensions inputs -->
      <div class="mb-2">
        <label class="mr-2">Width: 
          <input type="number" v-model.number="customWidth" class="w-24 p-1 border rounded" :disabled="selectedPreset"/>
        </label>
        <label>Height: 
          <input type="number" v-model.number="customHeight" class="w-24 p-1 border rounded" :disabled="selectedPreset"/>
        </label>
      </div>
      <!-- Quality slider -->
      <label class="block mb-4">Quality: {{ quality }}%
        <input type="range" v-model.number="quality" min="1" max="100" class="w-full">
      </label>
      <!-- Convert button -->
      <button @click="processImages" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" :disabled="processing">
        Convert Images
      </button>
    </div>

    <!-- Progress indicator -->
    <div v-if="processing" class="mt-4">
      <p class="mb-2">Processing images... {{ processedCount }} / {{ files.length }}</p>
      <div class="w-full bg-gray-300 rounded h-2">
        <div class="bg-green-500 h-2 rounded" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Download link (after processing) -->
    <div v-if="downloadUrl" class="mt-4">
      <a :href="downloadUrl" :download="zipName" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
        Download All Images (ZIP)
      </a>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-2 text-red-600">{{ error }}</p>
  </div>
</template>

<script>
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { processImage } from '@/utils/imageProcessor';  // our utility module

export default {
  name: 'FileUploader',
  data() {
    return {
      isDragging: false,
      files: [],           // { file: File, preview: URL, id: unique } objects
      nextId: 0,           // to assign unique IDs for list rendering
      presets: [           // preset size options
        { label: 'Thumbnail', width: 150, height: 150 },
        { label: 'Small', width: 640, height: 480 },
        { label: 'Medium', width: 1280, height: 720 },
        { label: 'Large', width: 1920, height: 1080 }
      ],
      selectedPreset: null,
      customWidth: null,
      customHeight: null,
      quality: 80,         // default 80%
      processing: false,
      processedCount: 0,
      downloadUrl: null,
      zipName: 'converted_images.zip',
      error: ''
    };
  },
  methods: {
    onDragOver() {
      this.isDragging = true;
    },
    onDragLeave() {
      this.isDragging = false;
    },
    onDrop(event) {
      this.isDragging = false;
      const droppedFiles = Array.from(event.dataTransfer.files);
      this.addFiles(droppedFiles);
    },
    onFileChange(event) {
      const selectedFiles = Array.from(this.$refs.fileInput.files);
      this.addFiles(selectedFiles);
      // reset the input so the same file can be re-selected if needed
      this.$refs.fileInput.value = '';
    },
    addFiles(fileList) {
      // Filter out any non-image files and duplicates
      fileList.forEach(file => {
        if (!file.type.startsWith('image/')) {
          this.error = `Skipping "${file.name}" (not an image file).`;
          return;
        }
        // avoid duplicate file (by name & size)
        const duplicate = this.files.some(f => f.file.name === file.name && f.file.size === file.size);
        if (duplicate) {
          this.error = `Skipping "${file.name}" (already added).`;
          return;
        }
        // create a preview URL for the image
        const previewURL = URL.createObjectURL(file);
        this.files.push({ file: file, preview: previewURL, id: this.nextId++ });
      });
    },
    removeFile(index) {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(this.files[index].preview);
      this.files.splice(index, 1);
    },
    onPresetChange() {
      if (this.selectedPreset) {
        // If a preset is chosen, fill the custom width/height and disable editing
        this.customWidth = this.selectedPreset.width;
        this.customHeight = this.selectedPreset.height;
      } else {
        // Custom selected, clear preset values (user can input)
        this.customWidth = null;
        this.customHeight = null;
      }
    },
    formatSize(bytes) {
      // Helper to format file size in KB/MB
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1024 * 1024) return (bytes/1024).toFixed(1) + ' KB';
      return (bytes/1024/1024).toFixed(1) + ' MB';
    },
    async processImages() {
      if (!this.files.length) return;
      this.error = '';
      this.processing = true;
      this.processedCount = 0;
      this.downloadUrl = null;

      const zip = new JSZip();              // create zip archive
      const folder = zip.folder('images');  // optional folder within zip

      const targetWidth = this.customWidth || 0;
      const targetHeight = this.customHeight || 0;
      const qualityRatio = this.quality / 100;  // convert percent to 0-1

      for (const { file } of this.files) {
        try {
          // Process each image: resize & convert to WebP (returns a Blob)
          const resultBlob = await processImage(file, targetWidth, targetHeight, qualityRatio);
          // Determine output filename (original name with .webp extension)
          const baseName = file.name.replace(/\.[^.]+$/, '');  // remove extension
          const outputName = baseName + '.webp';
          // Add to ZIP
          folder.file(outputName, resultBlob);
        } catch (err) {
          console.error('Conversion error:', err);
          this.error = `Error processing "${file.name}": ${err.message || err}`;
        }
        this.processedCount++;
        // update progress bar (progressPercent is a computed property or can be derived)
        // we will handle progressPercent as a computed property for simplicity
      }

      try {
        // Generate the ZIP blob and create a download link
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        this.zipName = `converted_images_${Date.now()}.zip`;
        this.downloadUrl = URL.createObjectURL(zipBlob);
        // Alternatively, use FileSaver to prompt download:
        // saveAs(zipBlob, this.zipName);
      } catch (zipErr) {
        console.error('ZIP error:', zipErr);
        this.error = 'Failed to generate ZIP file.';
      } finally {
        this.processing = false;
      }
    }
  },
  computed: {
    progressPercent() {
      // Compute overall progress percentage
      if (!this.processing) return 0;
      return Math.round((this.processedCount / this.files.length) * 100);
    }
  },
  beforeUnmount() {
    // Revoke all object URLs to avoid memory leaks when component is destroyed
    this.files.forEach(f => URL.revokeObjectURL(f.preview));
  }
};
</script>
