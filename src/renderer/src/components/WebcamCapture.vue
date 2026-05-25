<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

/**
 * WebcamCapture — small wrapper around the browser's getUserMedia API.
 * Emits a Blob (JPEG) on capture; null on retake/clear.
 *
 * Lifecycle:
 *   idle → click "Start" → live preview → click "Capture" → frozen frame +
 *   blob emitted upward + camera released. Retake restarts the stream.
 *
 * Electron note: the main process must have a permission handler that
 * approves "media" on the default session — see src/main/index.ts.
 */

const props = withDefaults(
  defineProps<{ modelValue: Blob | null; circular?: boolean }>(),
  { circular: false }
)
const emit = defineEmits<{ 'update:modelValue': [Blob | null] }>()

const video = ref<HTMLVideoElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const stream = ref<MediaStream | null>(null)
const streaming = ref(false)
const error = ref<string | null>(null)
const previewUrl = ref<string>('')

async function start(): Promise<void> {
  error.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    })
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
    }
    streaming.value = true
  } catch (e) {
    error.value = (e as Error).message ?? 'Could not access camera.'
    stop()
  }
}

function stop(): void {
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
  streaming.value = false
}

function capture(): void {
  if (!video.value || !canvas.value) return
  const w = video.value.videoWidth
  const h = video.value.videoHeight
  if (!w || !h) return
  canvas.value.width = w
  canvas.value.height = h
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video.value, 0, 0, w, h)
  canvas.value.toBlob(
    (blob) => {
      if (!blob) return
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = URL.createObjectURL(blob)
      emit('update:modelValue', blob)
      stop()
    },
    'image/jpeg',
    0.9
  )
}

function retake(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  emit('update:modelValue', null)
  void start()
}

function clearPhoto(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  emit('update:modelValue', null)
  stop()
}

onUnmounted(() => {
  stop()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="space-y-3">
    <div
      class="bg-cream-200 overflow-hidden grid place-items-center border border-cream-300/60"
      :class="props.circular ? 'aspect-square rounded-full' : 'aspect-[4/3] rounded-lg'"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        class="w-full h-full object-cover"
        alt="Captured"
      />
      <video
        v-show="streaming && !previewUrl"
        ref="video"
        class="w-full h-full object-cover"
        playsinline
        muted
      />
      <div v-if="!streaming && !previewUrl" class="text-sm text-ink-600 text-center px-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-10 h-10 mx-auto mb-2 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Click "Start camera" to take a photo.
      </div>
    </div>
    <canvas ref="canvas" class="hidden" />

    <div class="flex flex-wrap gap-2">
      <button
        v-if="!streaming && !previewUrl"
        type="button"
        class="btn-primary"
        @click="start"
      >
        Start camera
      </button>
      <button
        v-if="streaming"
        type="button"
        class="btn-primary"
        @click="capture"
      >
        Capture
      </button>
      <button
        v-if="previewUrl"
        type="button"
        class="btn-primary"
        @click="retake"
      >
        Retake
      </button>
      <button
        v-if="streaming || previewUrl"
        type="button"
        class="px-5 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-cream-200 transition"
        @click="clearPhoto"
      >
        Cancel
      </button>
    </div>

    <p v-if="error" class="text-sm text-maroon-accent">{{ error }}</p>
  </div>
</template>
