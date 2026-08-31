import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";
import { MohsinProjectLogo } from "@/components/MohsinProjectLogo";
import rizqSymbol from "@/public/assets/rizq-symbol.png";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between">
      {/* Top Left: ZahraOS & The Mohsin Project Logo */}
      <header className="w-full px-6 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MohsinProjectLogo className="h-7 w-auto shrink-0" />
          <div className="flex flex-col">
            <span className="font-['Oswald'] font-bold text-lg tracking-wide text-[#14161B] leading-tight">
              ZahraOS
            </span>
            <span className="text-xs font-normal text-[#8A8E99] font-['Jost'] leading-tight">
              Enterprise Platform Console
            </span>
          </div>
        </div>
      </header>

      {/* Main Form Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[440px]">
          {/* Partner Brand Symbol Centered Outside Card */}
          <div className="flex justify-center mb-6">
            <Image
              src={rizqSymbol}
              alt="Rizq"
              width={64}
              height={64}
              className="w-14 h-14 object-contain"
              priority
            />
          </div>

          {/* Auth Card */}
          <div className="bg-white border border-[#E2E4E8] rounded-xl p-6 sm:p-8 shadow-xs">
            <div className="mb-6 pb-4 border-b border-[#ECEEF2]">
              <h1 className="font-['Oswald'] text-xl font-bold uppercase tracking-tight text-[#14161B]">
                Partner Sign In
              </h1>
              <p className="mt-1 text-sm text-[#4A4D57] font-['Jost'] leading-relaxed">
                Enter your organizational credentials to access governance & module operations.
              </p>
            </div>

            <LoginForm />
          </div>

          {/* Footer Note with Colored Mohsin Project Logo After "The Mohsin Project" */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#8A8E99] font-['Jost'] flex-wrap text-center">
            <span>Powered by ZahraOS</span>
            <span>·</span>
            <span>A free software by The Mohsin Project</span>
            <MohsinProjectLogo className="h-3 w-auto inline-block" />
          </div>
        </div>
      </main>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}
