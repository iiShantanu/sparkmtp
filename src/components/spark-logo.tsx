import sparkLogoAsset from "@/assets/spark-logo.png.asset.json";

type Size = "sm" | "md" | "lg" | "xl";

const HEIGHT: Record<Size, string> = {
  sm: "h-7",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

export function SparkLogo({
  size = "md",
  className = "",
  alt = "Spark",
}: {
  size?: Size;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={sparkLogoAsset.url}
      alt={alt}
      className={`${HEIGHT[size]} w-auto select-none ${className}`}
      draggable={false}
    />
  );
}

export const SPARK_LOGO_URL = sparkLogoAsset.url;