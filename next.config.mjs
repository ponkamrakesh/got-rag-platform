/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
    PINECONE_HOST: process.env.PINECONE_HOST,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
