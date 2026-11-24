import React, { useEffect, useState } from 'react';

interface AccessiblePasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  showAriaLabel?: string;
  hideAriaLabel?: string;
  rightLabelAdornment?: React.ReactNode;
  children?: React.ReactNode;
}

const EyeIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.25 12s3.5-6.75 9.75-6.75S21.75 12 21.75 12s-3.5 6.75-9.75 6.75S2.25 12 2.25 12Z" />
    <circle cx="12" cy="12" r="3.1" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 4.88c6.25 0 9.75 7.12 9.75 7.12a16.8 16.8 0 0 1-3.17 4.27" />
    <path d="M6.61 6.61A13.53 13.53 0 0 0 2.25 12s3.5 7.12 9.75 7.12c1.82 0 3.45-.48 4.84-1.26" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

export const AccessiblePasswordField: React.FC<AccessiblePasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
  required = true,
  showAriaLabel,
  hideAriaLabel,
  rightLabelAdornment,
  children,
}) => {
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Clear live announcement automatically when password is hidden via mode/modal reset
  useEffect(() => {
    if (!visible) {
      setLiveAnnouncement((prev) => (prev ? `${label} hidden` : ''));
    }
  }, [visible, label]);

  const showText = showAriaLabel || `Show ${label.toLowerCase()}`;
  const hideText = hideAriaLabel || `Hide ${label.toLowerCase()}`;

  const handleToggle = () => {
    const nextVisible = !visible;
    setLiveAnnouncement(nextVisible ? `${label} shown` : `${label} hidden`);
    onToggleVisible();
  };

  return (
    <div className="kg-field">
      <div className="kg-label-row">
        <label className="kg-label" htmlFor={id}>
          {label}
        </label>
        {rightLabelAdornment}
      </div>

      <div className="kg-input-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="kg-input kg-input--with-toggle"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <button
          type="button"
          className={`kg-eye-btn ${visible ? 'kg-eye-btn--active' : ''}`}
          onClick={handleToggle}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? hideText : showText}
          title={visible ? hideText : showText}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <span className="kg-sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </span>
      </div>

      {children}
    </div>
  );
};
