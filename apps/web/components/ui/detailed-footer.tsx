import Link from "next/link";
import Logo from "./logo";
import { X, Linkedin, Facebook, Youtube } from "lucide-react";

const footerLinks = [
  {
    title: "Services",
    links: [
      { name: "CNC Machining", href: "#" },
      { name: "3D Printing", href: "#" },
      { name: "Sheet Metal", href: "#" },
      { name: "Injection Molding", href: "#" },
      { name: "Die Casting", href: "#" },
      { name: "Assembly Services", href: "#" },
    ],
  },
  {
    title: "Industries",
    links: [
      { name: "Aerospace", href: "#" },
      { name: "Automotive", href: "#" },
      { name: "Medical Devices", href: "#" },
      { name: "Electronics", href: "#" },
      { name: "Energy", href: "#" },
      { name: "Consumer Products", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Design Guidelines", href: "#" },
      { name: "Material Guide", href: "#" },
      { name: "FAQ", href: "#" },
      { name: "Help Center", href: "/support" },
      { name: "Blog", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About Us", href: "#" },
      { name: "Careers", href: "#" },
      { name: "Press", href: "#" },
      { name: "Investor Relations", href: "#" },
      { name: "Leadership Team", href: "#" },
    ],
  },
  {
    title: "Partners",
    links: [
      { name: "Manufacturing Network", href: "#" },
      { name: "Technology Partners", href: "#" },
      { name: "Integration Partners", href: "#" },
      { name: "Become a Supplier", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Contact Us", href: "/support" },
      { name: "Technical Support", href: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Terms of Service", href: "#" },
      { name: "Privacy Policy", href: "#" },
      { name: "Cookie Policy", href: "#" },
      { name: "GDPR Compliance", href: "#" },
      { name: "Accessibility", href: "#" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { name: "ISO Certifications", href: "#" },
      { name: "ITAR Compliance", href: "#" },
      { name: "Security Standards", href: "#" },
      { name: "Quality Reports", href: "#" },
      { name: "Audit Documentation", href: "#" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="bg-[#0a1b33] text-slate-400 pt-20 pb-10 mt-20 border-t border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-10 mb-20">
          {footerLinks.map((section) => (
            <div key={section.title} className="flex flex-col gap-6">
              <h4 className="text-white font-semibold text-sm tracking-wider uppercase">
                {section.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-slate-400 hover:text-white transition-all duration-200 text-sm font-medium"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-10 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/" className="mb-2">
              <Logo classNames="h-7 w-auto brightness-0 invert" />
            </Link>
            <p className="text-xs text-slate-500 max-w-sm text-center md:text-left">
              © {new Date().getFullYear()} Frigate Engineering Services. All
              rights reserved. Precision manufacturing at scale. Secure &
              Confidential.
            </p>
          </div>

          <div className="flex items-center gap-5">
            {[
              {
                icon: Linkedin,
                href: "https://www.linkedin.com/company/frigates/posts/?feedView=all",
              },
              { icon: Facebook, href: "https://www.facebook.com/FRIGATErs/" },
              {
                icon: Youtube,
                href: "https://www.youtube.com/@frigatemanufacturing",
              },
              { icon: X, href: "https://x.com/Frigateindia/" },
            ].map((social, i) => (
              <Link
                key={i}
                href={social.href}
                className="w-10 h-10 rounded-full bg-slate-800/30 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-300"
              >
                <social.icon className="w-5 h-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
