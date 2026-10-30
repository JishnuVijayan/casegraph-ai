import type { ReactNode } from 'react';

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}
type P = { size?: number };
export const MicIcon = (p: P) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
export const StopIcon = (p: P) => <Svg {...p}><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" /></Svg>;
export const ClipIcon = (p: P) => <Svg {...p}><path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.3-7.3" /></Svg>;
export const CameraIcon = (p: P) => <Svg {...p}><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.4" /></Svg>;
export const TrashIcon = (p: P) => <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M12 4 2.8 20h18.4zM12 10v5M12 17.8v.2" /></Svg>;
export const PhoneIcon = (p: P) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 5.6A1.5 1.5 0 0 1 5 4z" /></Svg>;
export const FileIcon = (p: P) => <Svg {...p}><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" /></Svg>;
export const ChevronLeft = (p: P) => <Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>;
export const ChevronRight = (p: P) => <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></Svg>;
export const PrintIcon = (p: P) => <Svg {...p}><path d="M7 9V4h10v5M7 17H4V9h16v8h-3M7 14h10v6H7z" /></Svg>;
export const SparkIcon = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Svg>;
export const ShieldIcon = (p: P) => <Svg {...p}><path d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6z" /><path d="m9 12 2.2 2.2L15 10.4" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const SendIcon = (p: P) => <Svg {...p}><path d="M4 12 20 4l-5 16-3-6.5z" /></Svg>;
export const RefreshIcon = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2 5.5M20 5v6h-6" /></Svg>;
export const PencilIcon = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></Svg>;
export const HeartIcon = (p: P) => <Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
