"use client";

import React, { useState } from "react";
import {
  VerticalSteppedModal,
  Step,
} from "@/components/ui/modal/VerticalSteppedModal";
import { Box, Settings, ShieldCheck, Rocket } from "lucide-react";

export default function SteppedModalDemo() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps: Step[] = [
    {
      id: "project",
      title: "Project Setup",
      description: "Define your project name and type",
    },
    {
      id: "config",
      title: "Configuration",
      description: "Select your preferred settings",
    },
    {
      id: "security",
      title: "Security",
      description: "Setup access controls",
    },
    {
      id: "review",
      title: "Review",
      description: "Final check before launch",
    },
  ];

  const handleOpen = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsOpen(false);
    alert("Project Created Successfully!");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background Blobs for the page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-2xl text-center relative z-10">
        <div className="h-20 w-20 bg-teal-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-teal-600 shadow-inner">
          <Rocket size={40} />
        </div>
        <h1 className="text-3xl font-black mb-3 text-slate-900 tracking-tight">
          Project Hub
        </h1>
        <p className="text-slate-500 mb-10 font-medium">
          Initialize your next big idea with our premium deployment wizard.
        </p>

        <button
          onClick={handleOpen}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Launch Wizard
        </button>
      </div>

      <VerticalSteppedModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Configuration"
        subtitle="Fine-tune your project parameters for optimal performance and scale."
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Initialize Launch"
      >
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                <Box size={24} />
              </div>
              <h3 className="font-bold text-lg">Project Details</h3>
              <p className="text-sm text-slate-500 mt-1">
                Start by giving your project a unique name and selecting its
                category.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">
                Project Name
              </label>
              <input
                type="text"
                placeholder="e.g. Apollo Space Mission"
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl outline-none transition-all"
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4 text-amber-600">
                <Settings size={24} />
              </div>
              <h3 className="font-bold text-lg">Technical Settings</h3>
              <p className="text-sm text-slate-500 mt-1">
                Configure the runtime and environment variables.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {["Production", "Staging", "Development", "Sandox"].map((env) => (
                <div
                  key={env}
                  className="p-4 border-2 border-slate-100 rounded-2xl hover:border-teal-500 cursor-pointer transition-all"
                >
                  <p className="font-bold text-sm">{env}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 text-center py-8">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-xl font-bold">Security Verification</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Click below to verify that your configurations meet the security
              standards.
            </p>
            <button className="px-8 py-3 bg-teal-500 text-white rounded-full font-bold shadow-lg shadow-teal-500/20">
              Verify Now
            </button>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold border-b pb-4 border-slate-100">
              Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-medium">Project Name</span>
                <span className="font-bold">Apollo Space Mission</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-medium">Environment</span>
                <span className="font-bold text-green-600">Production</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-medium">
                  Security Level
                </span>
                <span className="font-bold text-teal-600">High (Verified)</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-8 text-center uppercase tracking-widest font-bold">
              Ready to deploy
            </p>
          </div>
        )}
      </VerticalSteppedModal>
    </div>
  );
}
