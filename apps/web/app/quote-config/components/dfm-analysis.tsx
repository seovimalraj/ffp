import { BarChart4 } from "lucide-react";
import React from "react";
import { PartConfig } from "./part-card-item";

const DFMAnalysis = ({ part }: { part: PartConfig }) => {
  console.log(part);
  return (
    <div className="text-center max-w-sm">
      <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 flex items-center justify-center mx-auto shadow-sm mb-6">
        <BarChart4 className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        DFM Analysis Running
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed">
        Automated manufacturability feedback and cost estimation is currently
        being processed for this geometry.
      </p>
    </div>
  );
};

export default DFMAnalysis;
