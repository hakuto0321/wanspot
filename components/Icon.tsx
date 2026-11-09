// 線のSVGアイコン（CLAUDE.md：絵文字は使わない）
type IconName =
  | "search"
  | "heart"
  | "pencil"
  | "user"
  | "chevron-left"
  | "navigation"
  | "phone"
  | "map-pin"
  | "check"
  | "plus";

const PATHS: Record<IconName, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.9 3.1-7 7-7s7 3.1 7 7",
  "chevron-left": "M15 5l-7 7 7 7",
  navigation: "M12 2 19 21l-7-4-7 4 7-19Z",
  phone:
    "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  "map-pin": "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  check: "M5 12.5 10 17 19 7",
  plus: "M12 5v14M5 12h14",
};

export default function Icon({
  name,
  className = "h-6 w-6",
  title,
}: {
  name: IconName;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
