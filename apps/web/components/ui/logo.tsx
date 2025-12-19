import React from "react";

const Logo = ({ classNames }: { classNames?: string }) => {
  return (
    <img
      src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png"
      alt="FastParts"
      className={classNames}
    />
  );
};

export default Logo;
