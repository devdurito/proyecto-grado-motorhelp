<template>
  <svg
    :class="sizeClass"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: String, default: 'md' }
})

// Iconos de trazo (24x24) para mantener un set visual uniforme sin dependencias externas.
const ICONS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5'],
  catalog: ['M4 5h16v14H4z', 'M4 9h16', 'M9 9v10'],
  calculator: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 7h8', 'M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  moto: ['M5.5 17.5a3 3 0 1 0 0-.01', 'M18.5 17.5a3 3 0 1 0 0-.01', 'M5.5 17.5 9 10h5l2.5 7.5', 'M14 10l2-4h3', 'M9 10 7.5 7H5'],
  document: ['M7 3h7l5 5v13H7z', 'M14 3v5h5', 'M10 13h6M10 17h6'],
  finance: ['M12 3v18', 'M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3'],
  warehouse: ['M3 9.5 12 4l9 5.5V20H3z', 'M7 20v-6h10v6', 'M7 17h10'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 21h8M9 17h6v4H9z'],
  users: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21v-1a6 6 0 0 1 12 0v1', 'M16 3.5a4 4 0 0 1 0 7', 'M22 21v-1a6 6 0 0 0-4-5.6'],
  shield: ['M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z', 'M9 12l2 2 4-4'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M21 21l-4.3-4.3'],
  bell: ['M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M18 6 6 18'],
  logout: ['M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', 'M10 17l5-5-5-5', 'M15 12H3'],
  chevron: ['M6 9l6 6 6-6'],
  alert: ['M12 3 2 20h20z', 'M12 10v4', 'M12 17h.01'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M10 11v6M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  wrench: ['M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8z', 'M14.7 6.3 11 2.6a4 4 0 0 0-5 5l3.7 3.7']
}

const paths = computed(() => ICONS[props.name] || ICONS.box)
const sizeClass = computed(() => ({ sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }[props.size] || 'h-5 w-5'))
</script>
