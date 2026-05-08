export type IconName =
  | "spark"
  | "grid"
  | "file"
  | "brain"
  | "chat"
  | "history"
  | "settings"
  | "user"
  | "upload"
  | "download"
  | "search"
  | "check"
  | "plus"
  | "trash"
  | "edit"
  | "arrow"
  | "target"
  | "key"
  | "layout"
  | "light";

const iconPaths: Record<IconName, string> = {
  spark:
    "M12 2l1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Zm-6 13 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Zm13 1 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  file: "M6 3h8l4 4v14H6V3Zm8 1v4h4M9 13h6M9 17h6M9 9h3",
  brain:
    "M9 5a3 3 0 0 0-3 3 4 4 0 0 0-1 7 3.5 3.5 0 0 0 4 4m0-14a3 3 0 0 1 3 3v11m3-14a3 3 0 0 1 3 3 4 4 0 0 1 1 7 3.5 3.5 0 0 1-4 4m0-14a3 3 0 0 0-3 3v11M8 10h2m4 0h2M7 14h3m4 0h3",
  chat: "M4 5h16v11H8l-4 4V5Zm4 4h8M8 13h6",
  history: "M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4h4m4-1v6l4 2",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.5 4a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L16 3h-4l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1L12 21h4l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 9a8 8 0 0 0-16 0",
  upload: "M12 16V4m0 0 4 4m-4-4-4 4M5 16v4h14v-4",
  download: "M12 4v12m0 0 4-4m-4 4-4-4M5 20h14",
  search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  key: "M15 7a4 4 0 1 0-3.5 3.9L4 18.5V21h3v-2h2v-2h2l3.1-3.1A4 4 0 0 0 15 7Z",
  layout: "M4 5h16v14H4V5Zm6 0v14M4 10h16",
  light: "M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3Zm-3 18h6M10 17h4",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`icon ${className}`}>
      <path d={iconPaths[name]} />
    </svg>
  );
}
