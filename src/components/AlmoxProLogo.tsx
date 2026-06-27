export function AlmoxProLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 400 400" 
      className={className}
      width="100%" 
      height="100%"
    >
      <defs>
        <clipPath id="circle-clip">
          <circle cx="200" cy="200" r="190" />
        </clipPath>
        
        {/* Subtle wavy lines for the background */}
        <pattern id="waves" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
          <path d="M0,100 Q100,50 200,100 T400,100" fill="none" stroke="rgba(0, 174, 239, 0.3)" strokeWidth="2" />
          <path d="M0,120 Q100,70 200,120 T400,120" fill="none" stroke="rgba(0, 174, 239, 0.2)" strokeWidth="2" />
          <path d="M0,140 Q100,90 200,140 T400,140" fill="none" stroke="rgba(0, 174, 239, 0.15)" strokeWidth="2" />
          <path d="M0,160 Q100,110 200,160 T400,160" fill="none" stroke="rgba(0, 174, 239, 0.1)" strokeWidth="2" />
        </pattern>
        
        <linearGradient id="circle-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14365D" />
          <stop offset="50%" stopColor="#0B1E36" />
          <stop offset="100%" stopColor="#05101F" />
        </linearGradient>
 
        {/* Diagonal dark cut shape present in the logo */}
        <linearGradient id="dark-cut" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0A1C34" stopOpacity="1" />
          <stop offset="100%" stopColor="#061222" stopOpacity="0.8" />
        </linearGradient>
      </defs>
 
      {/* Main Circle Background */}
      <circle cx="200" cy="200" r="190" fill="url(#circle-bg)" />
      
      {/* Container for waves (clipped to circle) */}
      <g clipPath="url(#circle-clip)">
        <rect x="0" y="0" width="400" height="400" fill="url(#waves)" />
        
        {/* Dark sweep characteristic of the logo's bottom right */}
        <path d="M 220 400 L 400 200 L 400 400 Z" fill="url(#dark-cut)" />
      </g>
 
      {/* The ALMOXPRO Text Box */}
      <g transform="translate(45, 175)">
        <rect 
          x="0" 
          y="0" 
          width="310" 
          height="70" 
          rx="6" 
          fill="transparent" 
          stroke="white" 
          strokeWidth="6" 
        />
        <text 
          x="155" 
          y="48" 
          fill="white" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="44" 
          fontWeight="900" 
          fontStyle="italic"
          textAnchor="middle" 
          letterSpacing="1"
        >
          ALMOXPRO
        </text>
      </g>
    </svg>
  );
}
