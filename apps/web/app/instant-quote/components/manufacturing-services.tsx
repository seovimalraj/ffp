"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    id: "cnc",
    name: "CNC Machining",
    title: "CNC Machining",
    description:
      "Get highly precise, custom machined parts with our state-of-the-art CNC mills and lathes. We offer rapid prototyping and low-to-mid volume production with unmatched speed and accuracy.",
    bullets: [
      "Tolerances down to ±0.005mm for complex geometries",
      "Wide range of metals and industrial-grade plastics",
      "Fast turnaround times starting from 3 days",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/cnc-milling.webp",
  },
  {
    id: "sheet-metal",
    name: "Sheet Metal",
    title: "Sheet Metal Fabrication",
    description:
      "Fast, cost-effective sheet metal fabrication services from rapid prototyping to high-volume production. We offer laser cutting, bending, and a variety of finishes.",
    bullets: [
      "Precision laser cutting and CNC bending",
      "Wide selection of materials including steel, aluminum, and copper",
      "Finishing options like powder coating and anodizing",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/sheet-metal.webp",
  },
  {
    id: "injection-molding",
    name: "Injection Molding",
    title: "Injection Molding",
    description:
      "Get affordable, high-quality molded parts and bridge tooling within days. With our free moldability consultation, the design and molding process is rapidly accelerated to save you time and money.",
    bullets: [
      "Low-volume molding up to 100,000+ parts with volume pricing available—no MOQ required",
      "100+ plastic, elastomeric, and silicone rubber materials",
      "Automated CMM for fast, in-house quality documentation",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/injection-molding.webp",
  },
  {
    id: "extrusion",
    name: "Extrusion",
    title: "Extrusion",
    description:
      "Custom aluminum and plastic extrusion services for profiles of any complexity. We deliver high-quality, continuous shapes with tight tolerances for various applications.",
    bullets: [
      "Custom tooling created to your exact specifications",
      "Multiple alloys and plastic materials available",
      "Secondary operations like cutting, drilling, and finishing",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/extrusion.webp",
  },
  {
    id: "casting",
    name: "Casting",
    title: "Casting",
    description:
      "High-quality casting services including die casting, investment casting, and sand casting. Perfect for complex shapes and large parts in a variety of metals.",
    bullets: [
      "Excellent surface finish and dimensional accuracy",
      "Ideal for complex internal cavities and thin walls",
      "Cost-effective for medium to high volume runs",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/die-casting.webp",
  },
  {
    id: "stamping",
    name: "Stamping",
    title: "Stamping",
    description:
      "Precision metal stamping for high-volume production. We provide progressive die stamping, deep drawing, and fine blanking for consistent, tight-tolerance parts.",
    bullets: [
      "High-speed production for maximum cost efficiency",
      "Capabilities for complex forming and deep drawing",
      "Integrated quality control for consistent part dimensions",
    ],
    image: "https://frigate.ai/wp-content/uploads/2024/04/stamping.webp",
  },
];

export function ManufacturingServices() {
  const [activeTab, setActiveTab] = useState(services[0].id);

  const activeService = services.find((s) => s.id === activeTab) || services[0];

  return (
    <section className="py-16 mb-8 relative">
      <div className="w-full">
        <h2 className="text-3xl font-medium text-center text-slate-800 mb-10">
          Our Manufacturing Services
        </h2>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center border-b border-slate-200 mb-16 gap-x-8 gap-y-4">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setActiveTab(service.id)}
              className={`pb-4 text-sm font-medium transition-all relative ${
                activeTab === service.id
                  ? "text-blue-600 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {service.name}
              {activeTab === service.id && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[300px]">
          {/* Left: Text & Button */}
          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-2xl font-bold text-slate-800">
              {activeService.title}
            </h3>
            <p className="text-slate-600 leading-normal text-[15px]">
              {activeService.description}
            </p>
            <Button className="bg-blue-50/50 text-blue-700 hover:bg-blue-100 font-medium px-8 py-2.5 h-auto shadow-none rounded-md">
              Learn More
            </Button>
          </div>

          {/* Middle: Bullets */}
          <div className="lg:col-span-4 space-y-4">
            {activeService.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 text-slate-700">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-slate-700 text-[14px] leading-relaxed">{bullet}</p>
              </div>
            ))}
          </div>

          {/* Right: Image */}
          <div className="lg:col-span-4 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={activeService.image}
                alt={activeService.title}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/600x400/ffffff/94a3b8?text=" +
                    encodeURIComponent(activeService.name);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
