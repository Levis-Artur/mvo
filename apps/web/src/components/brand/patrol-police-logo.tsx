import Image from 'next/image';

export function PatrolPoliceLogo({ className }: { className: string }) {
  return (
    <Image
      alt="Патрульна поліція України"
      className={className}
      height={974}
      priority
      src="/patrol-police-logo.png"
      width={1043}
    />
  );
}
