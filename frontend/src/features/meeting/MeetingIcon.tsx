import type { SVGProps } from 'react'

type MeetingIconName =
  | 'mic'
  | 'micOff'
  | 'camera'
  | 'cameraOff'
  | 'screenShare'
  | 'participants'
  | 'chat'
  | 'info'
  | 'layout'
  | 'more'
  | 'leave'
  | 'pip'
  | 'fullscreen'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'

const iconPaths: Record<MeetingIconName, string[]> = {
  mic: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z', 'M19 10v1a7 7 0 0 1-14 0v-1', 'M12 18v3', 'M8 21h8'],
  micOff: ['M9 9v2a3 3 0 0 0 5.12 2.12', 'M15 9V6a3 3 0 0 0-5.58-1.55', 'M19 10v1a7 7 0 0 1-1.64 4.5', 'M5 10v1a7 7 0 0 0 11.95 5.05', 'M12 18v3', 'M8 21h8', 'm3 3 18 18'],
  camera: ['M14 8h3l4-3v14l-4-3h-3', 'M3 6h11v12H3z'],
  cameraOff: ['M14 8h3l4-3v14l-4-3h-3', 'M3 6h11v12H3z', 'm3 3 18 18'],
  screenShare: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4', 'm8 10 3-3 3 3', 'M11 7v6'],
  participants: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M20 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  chat: ['M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 11v6', 'M12 7h.01'],
  layout: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  leave: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6'],
  pip: ['M3 4h18v16H3z', 'M12 12h7v5h-7z'],
  fullscreen: ['M8 3H5a2 2 0 0 0-2 2v3', 'M16 3h3a2 2 0 0 1 2 2v3', 'M21 16v3a2 2 0 0 1-2 2h-3', 'M3 16v3a2 2 0 0 0 2 2h3'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  close: ['m18 6-12 12', 'm6 6 12 12'],
}

export function MeetingIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: MeetingIconName }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      {iconPaths[name].map((path, index) => <path key={`${name}-${index}`} d={path} />)}
    </svg>
  )
}
