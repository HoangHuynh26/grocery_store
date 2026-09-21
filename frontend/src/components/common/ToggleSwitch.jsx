import React from 'react';

/**
 * Apple iOS Liquid Style Toggle Switch Component
 * 
 * @param {Object} props
 * @param {boolean} props.checked - Current boolean state
 * @param {Function} props.onChange - Toggle event handler (newChecked: boolean) => void
 * @param {string} [props.label] - Optional text label beside switch
 * @param {boolean} [props.disabled] - Disabled state
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Switch sizing
 * @param {string} [props.activeColor='var(--primary)'] - Track color when on
 * @param {string} [props.inactiveColor='#cbd5e1'] - Track color when off
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  label = null,
  disabled = false,
  size = 'md',
  activeColor = 'var(--primary)',
  inactiveColor = '#cbd5e1'
}) {
  const dimensions = {
    sm: { width: 34, height: 20, thumb: 16, translate: 14 },
    md: { width: 44, height: 24, thumb: 20, translate: 20 },
    lg: { width: 52, height: 28, thumb: 24, translate: 24 }
  }[size] || { width: 44, height: 24, thumb: 20, translate: 20 };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle(e);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none'
      }}
      onClick={handleToggle}
    >
      {/* Apple-style Capsule Track */}
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          backgroundColor: checked ? activeColor : inactiveColor,
          borderRadius: '9999px',
          padding: '2px',
          transition: 'background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease',
          boxShadow: checked
            ? '0 2px 8px rgba(5, 150, 105, 0.25), inset 0 1px 2px rgba(0, 0, 0, 0.06)'
            : 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
          outline: 'none',
          flexShrink: 0
        }}
      >
        {/* Apple-style Sliding Thumb */}
        <div
          style={{
            width: `${dimensions.thumb}px`,
            height: `${dimensions.thumb}px`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            transform: `translateX(${checked ? dimensions.translate : 0}px)`,
            transition: 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.18), 0 0 1px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>

      {/* Label if provided */}
      {label && (
        <span
          style={{
            fontSize: size === 'sm' ? '12px' : '13px',
            fontWeight: 600,
            color: checked ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'color 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
