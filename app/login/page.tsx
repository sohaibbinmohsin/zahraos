import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand header badge */}
        <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-[#14161B] text-white mb-6 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D3BD2A]"></span>
          <span className="font-['Oswald'] font-bold text-xs uppercase tracking-widest text-[#D3BD2A]">
            ZAHRAOS · ADMIN PLATFORM
          </span>
        </div>

        <h1 className="font-['Oswald'] text-2xl font-bold uppercase tracking-tight text-[#14161B]">
          Volunteer Operations Hub
        </h1>
        <p className="mt-2 text-sm text-[#4A4D57] font-['Jost']">
          Partner administration, candidate triage & verified hours accreditation
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E2E4E8] rounded-xl sm:px-10">
          <LoginForm />
        </div>

        <div className="mt-6 text-center text-xs text-[#8A8E99] font-['Jost']">
          <p>Protected by platform role authorization & cryptographic JWT bridge.</p>
          <p className="mt-1">© 2026 The Mohsin Project. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
