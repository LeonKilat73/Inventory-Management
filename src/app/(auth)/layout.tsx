export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
