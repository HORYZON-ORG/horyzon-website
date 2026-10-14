import Image from 'next/image';

export function PatrimonialBrandLogo() {
  return <figure className="patrimonial-brand-logo">
    <Image src="/horyzon-architetti-patrimoniali.png" width={1790} height={650} alt="Horyzon Consulting — Architetti Patrimoniali" unoptimized />
  </figure>;
}
