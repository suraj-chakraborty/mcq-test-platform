import React from 'react'

const Truncate = (title: string | undefined | null, maxLength: number) => {
  if (!title) return <></>;
  const truncatedTitle = title.trim().slice(0, maxLength) + (title.length > maxLength ? '...' : '');
  return (
    <>{truncatedTitle}</>
  );
}

export default Truncate