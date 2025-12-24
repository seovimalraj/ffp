import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-t pb-5 border-slate-100 pt-8 mt-12 text-center text-slate-400 text-sm">
      <div className="flex justify-center gap-6 mb-4">
        <Link href="#" className="hover:text-blue-600 transition-colors">
          Privacy
        </Link>
        <Link href="#" className="hover:text-blue-600 transition-colors">
          Terms
        </Link>
        <Link href="#" className="hover:text-blue-600 transition-colors">
          Support
        </Link>
      </div>
      <p>© 2025 Frigate Engineering Services. Secure & Confidential.</p>
    </footer>
  );
};

export default Footer;
