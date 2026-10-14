import React from 'react';

export default function StatusBadge({ status }) {
  const normStatus = (status || 'pending').toLowerCase();

  return (
    <span className={`badge badge-${normStatus}`}>
      <span className="badge-dot" />
      {normStatus}
    </span>
  );
}
