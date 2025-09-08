import React from "react";

export default function LoginLayout( { children }: { children: React.ReactNode }) {
  return (          
      <div className="bg-white rounded-lg shadow">
        {children}
      </div>   
  );
}