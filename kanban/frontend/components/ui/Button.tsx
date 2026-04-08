'use client';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'medium', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background 150ms, border-color 150ms, color 150ms, opacity 150ms',
    outline: 'none',
    ...(size === 'small' ? { fontSize: 12, padding: '4px 10px', minHeight: 28 }
      : size === 'large' ? { fontSize: 15, padding: '10px 20px', minHeight: 48 }
      : { fontSize: 13, padding: '6px 14px', minHeight: 36 }),
    ...(variant === 'outline'
      ? {
          background: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border-strong)',
          color: 'var(--color-text-secondary)',
        }
      : {
          background: 'var(--color-point)',
          borderColor: 'var(--color-point)',
          color: '#ffffff',
        }),
    ...(props.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
    ...style,
  };

  return (
    <button style={base} {...props}>
      {children}
    </button>
  );
}
