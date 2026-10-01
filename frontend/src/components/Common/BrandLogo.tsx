export function BrandLogo({ width }: { width: number }) {
  return (
    <img
      src="/brand.svg"
      alt="EKLab"
      width={width}
      style={{ width, height: 'auto', display: 'block' }}
    />
  );
}
