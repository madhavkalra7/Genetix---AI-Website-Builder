"use client";

import { useEffect, useState } from "react";

const loadingMessages = [
  "Building Your Project",
  "Adding some Genes", 
  "Checking DNA of your project",
  "Testing Blood Group",
  "Mixing AI ingredients",
  "Compiling your vision",
  "Crafting perfect code",
  "Optimizing performance",
  "Brewing some magic",
  "Matching Heredity"
];

interface ProjectLoadingProps {
  className?: string;
}

export function ProjectLoading({ className }: ProjectLoadingProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative flex flex-col items-center justify-center h-full overflow-hidden ${className}`}>
      {/* Background Video with Blur */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-30"
      >
        <source src="/loading.mp4" type="video/mp4" />
      </video>
      
      {/* Dark overlay for better content visibility */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Loading Video */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-2xl blur-xl"></div>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="relative w-64 h-64 object-cover rounded-2xl shadow-2xl border border-white/10"
          >
            <source src="/loading.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          
          {/* Overlay gradient for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-2xl"></div>
        </div>

        {/* Loading Messages */}
        <div className="text-center space-y-4">
          <div className="h-12 flex items-center justify-center">
            <h2 
              key={currentMessageIndex}
              className="text-2xl font-bold text-white animate-pulse transition-all duration-500 ease-in-out"
            >
              {loadingMessages[currentMessageIndex]}
            </h2>
          </div>
          
          {/* Loading dots animation */}
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>

          {/* Progress indicator */}
          <div className="w-64 h-1 bg-gray-700/50 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
          </div>

          <p className="text-gray-300 text-sm mt-4">
            Please wait while we craft your perfect website...
          </p>
        </div>
      </div>
    </div>
  );
}