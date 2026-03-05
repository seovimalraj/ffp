"use client";

import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Mail,
  Phone as PhoneIcon,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";

interface TechnicalSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqId?: string;
  rfqCode?: string;
  onSuccess?: () => void;
}

const TechnicalSupportModal = ({
  isOpen,
  onClose,
  rfqId,
  rfqCode,
  onSuccess,
}: TechnicalSupportModalProps) => {
  const { data: session } = useSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contact info state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Support message state
  const [supportMessage, setSupportMessage] = useState("");
  const [messageError, setMessageError] = useState("");

  // Pre-fill email from session
  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
    if (session?.user?.phone) {
      setPhone(session.user.phone);
    }
  }, [session]);

  const steps: Step[] = [
    {
      id: "contact-info",
      title: "Contact Details",
      description: "How we can reach you",
    },
    {
      id: "support-details",
      title: "Expert Assistance",
      description: "Your specific requirements",
    },
  ];

  const validateStep0 = (): boolean => {
    let valid = true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError("");
    }

    if (!phone) {
      setPhoneError("Phone number is required.");
      valid = false;
    } else {
      setPhoneError("");
    }

    return valid;
  };

  const validateStep1 = (): boolean => {
    if (!supportMessage.trim() || supportMessage.trim().length < 10) {
      setMessageError(
        "Please provide more detail (at least 10 characters) about your issue.",
      );
      return false;
    }
    setMessageError("");
    return true;
  };

  const onStepChange = (step: number) => {
    if (step > currentStep) {
      if (currentStep === 0 && !validateStep0()) return;
    }
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;

    setIsSubmitting(true);
    try {
      if (rfqId) {
        await apiClient.post(`/rfq/technical-support/${rfqId}`, {
          quoteCode: rfqCode,
          email,
          phone,
          text: supportMessage,
        });
      } else {
        await apiClient.post(`/rfq/technical-support`, {
          email,
          phone,
          text: supportMessage,
        });
      }

      setIsSubmitted(true);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to submit technical support request:", error);
      notify.error(
        error?.response?.data?.message ||
          "Failed to submit your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setIsSubmitted(false);
      setCurrentStep(0);
      setSupportMessage("");
      setMessageError("");
      setPhoneError("");
      setEmailError("");
      // Re-fill email and phone from session on reset
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
      if (session?.user?.phone) {
        setPhone(session.user.phone);
      }
    }, 300);
  };

  const commonTopics = [
    "Material Choice",
    "Tolerances",
    "DFM Feedback",
    "Surface Finish",
    "Lead Times",
  ];

  return (
    <VerticalSteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Technical Support"
      subtitle={rfqCode ? `Reference: ${rfqCode}` : "General Inquiry"}
      steps={steps}
      currentStep={currentStep}
      onStepChange={onStepChange}
      onSubmit={handleSubmit}
      submitLabel="Send Request"
      isSubmitting={isSubmitting}
      hideFooter={isSubmitted}
      hideSidebar={isSubmitted}
    >
      <div className="h-full">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {/* ── Step 0: Contact Information ── */}
              <StepContainer stepActive={currentStep === 0}>
                <div className="space-y-8">
                  <header className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Reach out to our experts
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                      Our technical team will use these details to get back to
                      you regarding your manufacturing queries.
                    </p>
                  </header>

                  <div className="space-y-6">
                    {/* Email Field */}
                    <div className="group space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                        <Mail className="w-4 h-4" />
                        Email Address
                      </Label>
                      <Input
                        name="email"
                        type="email"
                        placeholder="e.g. james@company.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError("");
                        }}
                        className={cn(
                          "h-14 border-slate-200 bg-slate-50/50 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-base",
                          emailError &&
                            "border-red-500 focus:ring-red-500 focus:border-red-500",
                        )}
                      />
                      {emailError && (
                        <p className="text-red-500 text-xs font-medium ml-1 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500" />
                          {emailError}
                        </p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div className="group space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                        <PhoneIcon className="w-4 h-4" />
                        Phone Number
                      </Label>
                      <div
                        className={cn(
                          "phone-input-container rounded-2xl overflow-hidden border border-slate-200 bg-slate-50/50 group-focus-within:ring-4 group-focus-within:ring-indigo-500/10 group-focus-within:border-indigo-500 group-focus-within:bg-white transition-all",
                          phoneError &&
                            "border-red-500 group-focus-within:ring-red-500/10 group-focus-within:border-red-500",
                        )}
                      >
                        <PhoneInput
                          placeholder="Enter phone number"
                          value={phone}
                          onChange={(value) => {
                            setPhone(value || "");
                            if (phoneError) setPhoneError("");
                          }}
                          defaultCountry="IN"
                          className="h-14 px-4 text-base"
                        />
                      </div>
                      {phoneError && (
                        <p className="text-red-500 text-xs font-medium ml-1 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500" />
                          {phoneError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </StepContainer>

              {/* ── Step 1: Support Details ── */}
              <StepContainer stepActive={currentStep === 1}>
                <div className="space-y-8">
                  <header className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      What can we help you with?
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                      Provide as much detail as possible about your technical
                      concerns or design requirements.
                    </p>
                  </header>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-slate-700">
                        Common support topics
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {commonTopics.map((topic, i) => (
                          <motion.button
                            key={topic}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            type="button"
                            onClick={() => {
                              if (!supportMessage.includes(topic)) {
                                setSupportMessage(
                                  (prev) =>
                                    (prev.length > 0 ? prev + "\n" : "") +
                                    `Regarding ${topic}: `,
                                );
                              }
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95 hover:shadow-sm"
                          >
                            {topic}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <MessageSquareText className="w-4 h-4 text-slate-400" />
                        Message Description
                      </Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Detailed description of your issue, design concern, or manufacturing question..."
                          className={cn(
                            "min-h-[240px] text-base p-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none shadow-sm",
                            messageError &&
                              "border-red-400 focus:border-red-500 focus:ring-red-500/10",
                          )}
                          value={supportMessage}
                          onChange={(e) => {
                            setSupportMessage(e.target.value);
                            if (messageError) setMessageError("");
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-medium text-red-500 italic">
                          {messageError}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md",
                              supportMessage.length < 10 &&
                                supportMessage.length > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            {supportMessage.length} / 10 min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </StepContainer>
            </motion.div>
          ) : (
            // ── Success State ──
            <motion.div
              key="success-container"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              className="h-full flex flex-col items-center justify-center text-center p-8 space-y-10"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-24 h-24 bg-teal-50 rounded-[32px] flex items-center justify-center text-teal-600 shadow-xl shadow-teal-500/10 border border-teal-100/50"
                >
                  <CheckCircle2 className="w-12 h-12" />
                </motion.div>
                <div className="absolute -z-10 inset-0 bg-teal-400/20 blur-3xl rounded-full animate-pulse" />
              </div>

              <div className="space-y-4 max-w-sm">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  Request Sent!
                </h2>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We've received your request{rfqCode ? ` for quote ` : "."}
                    {rfqCode && (
                      <span className="font-bold text-slate-900">
                        {rfqCode}
                      </span>
                    )}
                  </p>
                  <div className="h-px bg-slate-200 w-12 mx-auto" />
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Our technical expert will review your details and contact
                    you at{" "}
                    <span className="font-semibold text-indigo-600">
                      {email}
                    </span>{" "}
                    within{" "}
                    <span className="text-slate-900 font-bold">24 hours</span>.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full max-w-[240px] bg-slate-900 hover:bg-black text-white rounded-2xl h-14 font-black shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </VerticalSteppedModal>
  );
};

export default TechnicalSupportModal;
