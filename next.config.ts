import type {NextConfig} from 'next';
const nextConfig:NextConfig={async redirects(){return [
 {source:'/v/frank/Frank-Cannoletta.vcf',destination:'/v/frank/contact.vcf',permanent:true},
 {source:'/v/:person/index.php',destination:'/v/:person',permanent:true},
 {source:'/v/:person/download.php',destination:'/v/:person/contact.vcf',permanent:true}
]}};
export default nextConfig;
