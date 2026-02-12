import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="w-full lg:w-1/2 relative">
      {/* Inner Light Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      <SignInForm />
    </div>
  );
}
