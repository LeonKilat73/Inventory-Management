import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const fieldClass =
  "w-full rounded-md border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">
      {children}
    </span>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input className={fieldClass} {...props} />
    </label>
  );
}

export function TextAreaField({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea className={fieldClass} rows={3} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select className={fieldClass} {...props}>
        {children}
      </select>
    </label>
  );
}
