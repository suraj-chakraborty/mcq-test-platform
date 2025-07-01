import React from 'react'

const Truncate = (title: string, maxLength: number) => {
  const truncatedTitle = title.trim().slice(0, maxLength) + (title.length > maxLength ? '...' : '');
  return (
    <>{truncatedTitle}</>
  );
}

export default Truncate