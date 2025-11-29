import Link from 'next/link';
import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Home</h1>
      <Link href="/about">Go to About</Link>
      <br />
      <Link href="/map">Go to Blog 42</Link>
    </div>
  );
};

export default HomePage;
