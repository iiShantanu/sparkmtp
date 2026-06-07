import sparkLogoAsset from "@/assets/spark-logo.png.asset.json";

type Size = "sm" | "md" | "lg" | "xl";

const HEIGHT: Record<Size, string> = {
  sm: "h-10",
  md: "h-14",
  lg: "h-20",
  xl: "h-28",
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
      width={1024}
      height={512}
      loading="eager"
      decoding="async"
    />
  );
}

export const SPARK_LOGO_URL = sparkLogoAsset.url;