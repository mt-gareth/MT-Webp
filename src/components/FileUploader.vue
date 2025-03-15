<template>
  <div class="max-w-5xl mx-auto p-8 bg-gray-900 text-gray-200 min-h-screen flex flex-col items-center">

    <!-- Drag-and-drop area -->
    <div class="border-2 border-dashed border-gray-600 rounded-xl p-10 text-center cursor-pointer w-full"
           :class="{ 'border-blue-400 bg-gray-800': isDragging }"
           @dragover.prevent="onDragOver" 
           @dragleave.prevent="onDragLeave" 
           @drop.prevent="onDrop"
           @click="$refs.fileInput.click()">
      <p class="text-gray-400">
        <span v-if="!isDragging">Drag & drop images here, or click to select files</span>
        <span v-else class="text-blue-400">Release to drop the files</span>
      </p>
      <input type="file" multiple accept="image/*" class="hidden" ref="fileInput" @change="onFileChange" />
    </div>

    <!-- File preview cards -->
    <div v-if="files.length" class="mt-8 grid grid-cols-4 gap-4 w-full">
      <div v-for="(fileObj, index) in files" :key="fileObj.id" class="bg-gray-800 rounded shadow overflow-hidden">
        <img :src="fileObj.preview" class="object-cover w-full h-32 rounded-t" />
        <div class="p-2 text-sm">
          <p class="truncate">{{ fileObj.file.name }}</p>
          <p class="text-xs text-gray-500">{{ formatSize(fileObj.file.size) }}</p>
          <button @click="removeFile(index)" class="text-red-400 hover:text-red-600 text-xs mt-1">Remove</button>
        </div>
      </div>
    </div>

    <!-- Output settings -->
    <div v-if="files.length" class="mt-8 p-4 border border-gray-700 rounded bg-gray-800 w-full">
      <h3 class="font-semibold mb-4">Output Settings:</h3>

      <!-- Preset size -->
      <div class="mb-4">
        <label>Preset Size:
          <select v-model="selectedPreset" @change="onPresetChange" class="ml-2 bg-gray-700 border-gray-600 rounded p-1">
            <option value="">Custom</option>
            <option v-for="preset in presets" :key="preset.label" :value="preset">
              {{ preset.label }} ({{ preset.width }}×{{ preset.height }})
            </option>
          </select>
        </label>
      </div>

      <!-- Custom dimensions -->
      <div class="mb-4">
        <label class="mr-4">Width: 
          <input type="number" v-model.number="customWidth" class="w-28 bg-gray-700 border-gray-600 rounded p-1" :disabled="selectedPreset"/>
        </label>
        <label>Height: 
          <input type="number" v-model.number="customHeight" class="w-28 bg-gray-700 border-gray-600 rounded p-1" :disabled="selectedPreset"/>
        </label>
      </div>

      <!-- Quality slider -->
      <div class="mb-6">
        <label>Quality: {{ quality }}%
          <input type="range" v-model.number="quality" min="1" max="100" class="w-full">
        </label>
      </div>

      <!-- Convert Button -->
      <button @click="processImages" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded" :disabled="processing">
        Convert Images
      </button>

      <!-- Progress bar -->
      <div v-if="processing" class="mt-4">
        <p class="mb-2">Processing images... {{ processedCount }} / {{ files.length }}</p>
        <div class="w-full bg-gray-700 rounded h-2">
          <div class="bg-green-500 h-2 rounded" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- Download link -->
      <div v-if="downloadUrl" class="mt-4">
        <a :href="downloadUrl" :download="zipName" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white">
          Download ZIP
        </a>
      </div>

      <!-- Error message -->
      <p v-if="error" class="mt-2 text-red-500">{{ error }}</p>

    </div>

    <input type="file" multiple accept="image/*" class="hidden" ref="fileInput" @change="onFileChange">

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
