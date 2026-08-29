import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Set a new password</h1>
      <p className="mb-4 text-sm text-gray-600">
        You must set your own password before continuing.
      </p>
      <SetPasswordForm />
    </div>
  );
}
