import { ErrorFilled } from "../icons";

/**
 * The error line under a field that is not a React Aria field, such as the
 * code editor, styled as `TextField`'s own (DESIGN.md section 4.5). The field
 * names this line's `id` in its `aria-describedby`.
 */
export function FieldErrorMessage({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="flex items-start gap-2 text-sm text-fail">
      <span aria-hidden="true" className="inline-flex pbs-1">
        <ErrorFilled size={16} />
      </span>
      <span>{children}</span>
    </p>
  );
}
