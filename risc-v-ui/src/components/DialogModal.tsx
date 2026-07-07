import { useId, type ReactElement, type ReactNode } from "react";

interface DialogModalProps {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  cardClassName?: string;
}

export const DialogModal = ({
  isOpen,
  title,
  description,
  children,
  actions,
  cardClassName,
}: DialogModalProps): ReactElement | null => {
  const titleId = useId();
  const descriptionId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className={cardClassName ? `modal-card ${cardClassName}` : "modal-card"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descriptionId}>{description}</p>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};
