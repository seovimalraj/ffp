import "./custom-loader.css";

interface CustomLoaderProps {
  fullScreen?: boolean;
  fullSize?: boolean;
  className?: string;
}

const CustomLoader = ({
  fullScreen,
  fullSize,
  className = "",
}: CustomLoaderProps) => {
  const containerClasses = [
    "custom-loader-container",
    fullScreen ? "full-screen" : "",
    fullSize ? "full-size" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
};

export default CustomLoader;
