import React from 'react';
import { motion } from 'framer-motion';

export default function BlurText({
  text = '',
  delay = 50,
  className = '',
  animateBy = 'words', // 'words' or 'letters'
}) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: delay / 1000, delayChildren: 0.05 * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      filter: 'blur(6px)',
      y: 8,
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={`inline-block ${className}`}
    >
      {elements.map((el, i) => (
        <motion.span
          key={i}
          variants={child}
          className="inline-block mr-[0.25em] last:mr-0"
        >
          {el === ' ' ? '\u00A0' : el}
        </motion.span>
      ))}
    </motion.span>
  );
}
