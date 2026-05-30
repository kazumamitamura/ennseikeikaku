import clsx from 'clsx';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export default function Card({ className, title, children, ...props }: CardProps) {
  return (
    <div className={clsx('section-card', className)} {...props}>
      {title && <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>}
      {children}
    </div>
  );
}
